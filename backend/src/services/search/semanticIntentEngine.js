import { getSupabaseAdmin } from "../../supabaseClient.js";
import {
  mergePhraseAndDbOwnership,
  ownershipScoreAdjustments,
  resolveOwnershipContext
} from "./ownershipFamilySignals.js";
import {
  buildSkillAliasIndexes,
  fetchOwnershipFamiliesFromSkillIds,
  resolveProfessionalConcepts
} from "./skillAliasResolution.js";
import { fetchSkillGraphRoleRows } from "./skillGraphRetrieval.js";

function normalizeIntentQuery(rawQuery) {
  const base = String(rawQuery || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const corrections = {
    reactjs: "react",
    hrpb: "hrbp",
    apis: "api"
  };
  return base
    .split(" ")
    .map((t) => corrections[t] || t)
    .join(" ");
}

function normalizeTitleForIdentity(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/\b(senior|sr|junior|jr|lead|principal|staff|associate|intern|manager|head)\b/g, " ")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeIntentResults(rows, limitCount) {
  const byCanonical = new Map();
  for (const r of rows || []) {
    const canonicalTitle = String(r?.canonical_title || "").trim();
    const dept = String(r?.department_name || "").toLowerCase().trim();
    const identity = `${dept}::${normalizeTitleForIdentity(canonicalTitle)}`;
    const existing = byCanonical.get(identity);
    if (!existing || Number(r?.final_score || 0) > Number(existing?.final_score || 0)) {
      byCanonical.set(identity, r);
    }
  }
  return [...byCanonical.values()]
    .sort((a, b) =>
      Number(b?.final_score || 0) - Number(a?.final_score || 0) ||
      String(a?.canonical_title || "").localeCompare(String(b?.canonical_title || ""))
    )
    .slice(0, Math.min(Math.max(1, Number(limitCount || 10)), 50));
}

const INTENT_SYNONYM_MAP = {
  creates: ["create", "build", "develop", "implement"],
  create: ["creates", "build", "develop", "implement"],
  connects: ["connect", "integrate", "integration", "link"],
  connect: ["connects", "integrate", "integration", "link"],
  interfaces: ["interface", "ui", "ux", "screens"],
  dashboards: ["dashboard", "bi", "reporting"],
  analyzes: ["analyze", "analysis", "insights"],
  trends: ["trend", "forecast", "pattern"]
};

const INTENT_PRIORS = [
  {
    name: "api_backend_integration",
    patterns: [
      /\b(api)\b/,
      /\b(connect|integrat(e|ion)|build|create|develop)\b/
    ],
    includeRoleTokens: ["backend", "backend engineer", "platform", "platform engineer", "integration", "integration engineer", "api engineer", "data engineer"],
    includeDepts: ["engineering"],
    suppressRoleTokens: ["qa", "quality", "support", "technical support", "customer support", "helpdesk", "test engineer", "flutter", "mobile", "implementation specialist"]
  },
  {
    name: "analytics_data_stack",
    patterns: [/\b(pipeline|etl|warehouse|dashboard|bi|analytics)\b/],
    includeRoleTokens: ["data engineer", "data analyst", "analytics", "bi"],
    includeDepts: ["data"],
    suppressRoleTokens: ["support", "recruiter", "sales"]
  },
  {
    name: "design_ux_intent",
    patterns: [/\b(ui|ux|wireframe|prototype|figma|design system)\b/],
    includeRoleTokens: ["designer", "ux", "ui", "product designer"],
    includeDepts: ["design", "product"],
    suppressRoleTokens: ["accountant", "support", "qa"]
  }
];

const FAMILY_RETRIEVAL_VOCAB = {
  engineering: {
    core: ["api", "backend", "integration", "service", "distributed", "platform", "orchestration", "scalability", "system"],
    archetypes: {
      backend_engineer: ["backend systems", "service architecture", "api development", "service communication"],
      integration_engineer: ["api integration", "service integration", "connect systems", "orchestration"],
      platform_engineer: ["distributed systems", "platform systems", "scalability", "reliability"]
    }
  },
  hr_people_ops: {
    core: ["hiring", "recruiting", "sourcing", "talent acquisition", "candidate pipeline", "workforce hiring"],
    archetypes: {
      talent_acquisition: ["recruitment pipeline", "candidate sourcing", "hiring funnel"],
      hrbp_employee_relations: ["employee relations", "people partner", "hrbp"],
      people_operations: ["workforce operations", "people operations", "onboarding"]
    }
  },
  design_product: {
    core: ["mobile interface", "product ui", "app experience", "interaction system", "usability", "user flow", "mobile ux"],
    archetypes: {
      product_designer: ["product interface", "interaction design", "user journeys"],
      mobile_ui_designer: ["mobile ui", "app screens", "mobile ux", "interface flows"],
      ux_researcher: ["usability testing", "interaction research", "user flows"]
    }
  },
  data_analytics: {
    core: ["dashboard", "reporting", "business intelligence", "analytics", "insights", "trend analysis"],
    archetypes: {
      bi_analyst: ["business intelligence reporting", "dashboard metrics", "bi insights"],
      data_analyst: ["trend analysis", "analytics reporting", "insights reporting"],
      analytics_engineer: ["analytics pipelines", "dashboard data models", "reporting systems"]
    }
  }
};

const MOBILE_PRODUCT_OWNERSHIP_TERMS = [
  "mobile", "app", "interface", "interfaces", "ux", "ui", "product",
  "interaction", "usability", "flow", "user flow", "app experience",
  "product ui", "mobile ux", "interface behavior"
];

const GENERIC_DESIGN_ONLY_TERMS = ["brand", "curriculum", "graphic", "visual identity"];

function mapConfidence(score) {
  if (score >= 0.8) return "high";
  if (score >= 0.55) return "medium";
  return "low";
}

function containsAny(normalizedHaystack, terms) {
  const h = normalizeIntentQuery(normalizedHaystack);
  return (terms || []).some((term) => h.includes(normalizeIntentQuery(term)));
}

function computeIntentContext(normalizedQuery, filteredTokens) {
  const expandedTokenSet = new Set(filteredTokens || []);
  for (const t of filteredTokens || []) {
    for (const s of INTENT_SYNONYM_MAP[t] || []) expandedTokenSet.add(s);
  }
  const expandedTokens = [...expandedTokenSet].filter(Boolean);
  const expandedQuery = normalizeIntentQuery(expandedTokens.join(" "));

  const priorChecks = INTENT_PRIORS.map((prior) => {
    const checks = (prior.patterns || []).map((re) => ({
      pattern: String(re),
      normalizedQueryHit: re.test(normalizedQuery),
      expandedQueryHit: re.test(expandedQuery)
    }));
    const passNormalized = checks.every((c) => c.normalizedQueryHit);
    const passExpanded = checks.every((c) => c.expandedQueryHit);
    return {
      name: prior.name,
      checks,
      passNormalized,
      passExpanded
    };
  });

  const activePriors = priorChecks
    .filter((p) => p.passNormalized || p.passExpanded)
    .map((p) => INTENT_PRIORS.find((x) => x.name === p.name))
    .filter(Boolean);

  return {
    activePriors,
    tokenCount: (filteredTokens || []).length,
    expandedTokens,
    expandedQuery,
    priorChecks
  };
}

function inferExecutionIntent(normalizedQuery, expandedTokens) {
  const q = normalizeIntentQuery(normalizedQuery);
  const tset = new Set((expandedTokens || []).map((t) => normalizeIntentQuery(t)).filter(Boolean));

  const ACTS = {
    build: ["build", "create", "develop", "implement"],
    integrate: ["integrate", "integration", "connect", "link"],
    analyze: ["analyze", "analysis", "insight", "trend", "dashboard", "reporting", "report"],
    design: ["design", "interface", "ui", "ux", "wireframe", "prototype", "screen"],
    automate: ["automate", "automation"],
    operate: ["operate", "run", "maintain", "monitor"],
    support: ["support", "assist", "help", "resolve"],
    document: ["document", "documentation", "write", "writer"],
    test: ["test", "testing", "qa", "quality"]
  };
  const SURFACES = {
    backend: ["api", "backend", "service", "microservice", "integration", "integrate"],
    frontend: ["frontend", "web", "browser", "interface"],
    mobile_ui: ["mobile", "app", "ui", "ux", "screen", "interface"],
    analytics: ["dashboard", "trend", "analysis", "reporting", "bi", "insight"],
    infrastructure: ["platform", "infra", "infrastructure", "reliability", "devops", "kubernetes"],
    product_design: ["product design", "ux", "ui", "prototype", "interaction", "interface"],
    people_ops: ["hiring", "employee", "relations", "hr", "talent", "people"]
  };

  const acts = Object.entries(ACTS)
    .filter(([, words]) => words.some((w) => q.includes(w) || tset.has(w)))
    .map(([k]) => k);
  const surfaces = Object.entries(SURFACES)
    .filter(([, words]) => words.some((w) => q.includes(w) || tset.has(w)))
    .map(([k]) => k);

  const ownershipIntensity =
    acts.some((a) => ["build", "integrate", "design", "analyze", "automate", "operate"].includes(a))
      ? "high"
      : acts.length
        ? "medium"
        : "low";

  return { acts, surfaces, ownershipIntensity };
}

function detectTargetFamilies(intentCtx, executionIntent) {
  const out = new Set();
  for (const prior of intentCtx.activePriors || []) {
    if (prior.name === "api_backend_integration") out.add("engineering");
    if (prior.name === "analytics_data_stack") out.add("data_analytics");
    if (prior.name === "design_ux_intent") out.add("design_product");
  }
  if ((executionIntent?.surfaces || []).includes("backend") || (executionIntent?.surfaces || []).includes("infrastructure")) out.add("engineering");
  if ((executionIntent?.surfaces || []).includes("people_ops")) out.add("hr_people_ops");
  if ((executionIntent?.surfaces || []).includes("mobile_ui") || (executionIntent?.surfaces || []).includes("product_design")) out.add("design_product");
  if ((executionIntent?.surfaces || []).includes("analytics")) out.add("data_analytics");
  return [...out];
}

function mapRoleFamily(roleFamilyRaw, titleRaw) {
  const f = normalizeIntentQuery(roleFamilyRaw || "");
  const t = normalizeIntentQuery(titleRaw || "");
  if (f.includes("engineer") || f.includes("engineering")) return "engineering";
  if (f.includes("data") || f.includes("analytics")) return "data_analytics";
  if (f.includes("design") || f.includes("product")) return "design_product";
  if (f.includes("hr") || f.includes("people") || f.includes("talent")) return "hr_people_ops";
  if (t.includes("engineer") || t.includes("backend") || t.includes("api")) return "engineering";
  if (t.includes("analyst") || t.includes("business intelligence") || t.includes("dashboard")) return "data_analytics";
  if (t.includes("designer") || t.includes("ux") || t.includes("ui")) return "design_product";
  if (t.includes("hr") || t.includes("people") || t.includes("recruit")) return "hr_people_ops";
  return "unknown";
}

async function enrichIntentCandidates(sb, normalizedQuery, filteredTokens, intentCtx, executionIntent, limitCount) {
  const targetFamilies = detectTargetFamilies(intentCtx, executionIntent);
  if (!targetFamilies.length) {
    return { rows: [], debug: { used: false, reason: "no_target_family_detected" } };
  }

  const expandedTokens = (intentCtx.expandedTokens || []).map((t) => normalizeIntentQuery(t)).filter(Boolean);
  const queryTokens = [...new Set([...(filteredTokens || []), ...expandedTokens].map((t) => normalizeIntentQuery(t)).filter(Boolean))];
  const vocabTokens = [...new Set(
    targetFamilies.flatMap((f) => {
      const profile = FAMILY_RETRIEVAL_VOCAB[f] || { core: [], archetypes: {} };
      return [...(profile.core || []), ...Object.values(profile.archetypes || {}).flat()];
    }).map((t) => normalizeIntentQuery(t))
  )];
  const signalTokens = [...new Set([...queryTokens, ...vocabTokens])];

  const [rolesRes, metaRes] = await Promise.all([
    sb.from("roles_v2").select("id, canonical_title, role_family, hint, active").eq("active", true),
    sb.from("role_semantic_metadata").select("role_id, keywords, search_phrases, responsibilities, work_examples, tools, output_types")
  ]);
  if (rolesRes.error) throw new Error(rolesRes.error.message || "enrichment roles_v2 query failed");
  if (metaRes.error) throw new Error(metaRes.error.message || "enrichment metadata query failed");

  const byMeta = new Map((metaRes.data || []).map((m) => [m.role_id, m]));
  const isMobileProductIntent = targetFamilies.includes("design_product")
    && queryTokens.some((t) => ["mobile", "app", "interface", "ux", "ui", "product"].includes(t));

  const rows = (rolesRes.data || []).map((r) => {
    const titleNorm = normalizeIntentQuery(r.canonical_title || "");
    const family = mapRoleFamily(r.role_family, r.canonical_title);
    if (!targetFamilies.includes(family)) return null;

    const m = byMeta.get(r.id) || {};
    const metaText = normalizeIntentQuery([
      ...(Array.isArray(m.keywords) ? m.keywords : []),
      ...(Array.isArray(m.search_phrases) ? m.search_phrases : []),
      ...(Array.isArray(m.responsibilities) ? m.responsibilities : []),
      ...(Array.isArray(m.work_examples) ? m.work_examples : []),
      ...(Array.isArray(m.tools) ? m.tools : []),
      ...(Array.isArray(m.output_types) ? m.output_types : [])
    ].join(" "));

    const profile = FAMILY_RETRIEVAL_VOCAB[family] || { core: [] };
    const coreHits = (profile.core || []).filter((t) => titleNorm.includes(t) || metaText.includes(t)).length;
    const coreRatio = coreHits / Math.max(1, (profile.core || []).length);
    const signalHits = signalTokens.filter((t) => t && (titleNorm.includes(t) || metaText.includes(t))).length;
    const signalRatio = signalHits / Math.max(1, signalTokens.length);
    const titleAnchorHit = queryTokens.some((t) => titleNorm.includes(t)) ? 1 : 0;

    if (coreRatio < 0.08 && signalRatio < 0.16 && !titleAnchorHit) return null;

    let score = 0.42 + (0.28 * coreRatio) + (0.22 * signalRatio) + (0.08 * titleAnchorHit);
    if (isMobileProductIntent) {
      const mobileProductAnchor = MOBILE_PRODUCT_OWNERSHIP_TERMS.some((t) => titleNorm.includes(t) || metaText.includes(t));
      const genericDesign = GENERIC_DESIGN_ONLY_TERMS.some((t) => titleNorm.includes(t));
      if (genericDesign && !mobileProductAnchor) return null;
      if (mobileProductAnchor) score += 0.16;
    }
    score = Math.max(0, Math.min(1, score));
    if (score < 0.28) return null;

    return {
      role_id: r.id,
      canonical_title: r.canonical_title,
      department_name: r.role_family || "General",
      level_code: "L2",
      level_display: "Mid",
      final_score: score,
      confidence: mapConfidence(score),
      hint: r.hint || "",
      required_skills: [],
      good_to_have: [],
      aliases: [],
      matched_skills: [],
      missing_skills: [],
      matched_skill_count: 0,
      missing_skill_count: 0,
      why_matched: "Family/archetype retrieval enrichment match.",
      semantic_terms: signalTokens,
      percentile_25: null,
      percentile_75: null,
      benchmark_currency: "INR",
      salary_display: ""
    };
  }).filter(Boolean)
    .sort((a, b) => Number(b.final_score || 0) - Number(a.final_score || 0) || String(a.canonical_title || "").localeCompare(String(b.canonical_title || "")))
    .slice(0, Math.min(Math.max(1, Number(limitCount || 10)), 50));

  return {
    rows,
    debug: {
      used: true,
      targetFamilies,
      queryTokenCount: queryTokens.length,
      signalTokenCount: signalTokens.length,
      candidateCount: rows.length
    }
  };
}

function refineMobileProductCandidates(rows, normalizedQuery, expandedTokens) {
  const q = normalizeIntentQuery(normalizedQuery);
  const et = new Set((expandedTokens || []).map((t) => normalizeIntentQuery(t)));
  const isMobileIntent =
    MOBILE_PRODUCT_OWNERSHIP_TERMS.some((t) => q.includes(t)) ||
    [...et].some((t) => MOBILE_PRODUCT_OWNERSHIP_TERMS.includes(t));
  if (!isMobileIntent) return { rows, debug: { used: false, reason: "not_mobile_product_intent" } };

  const filtered = (rows || []).filter((r) => {
    const titleNorm = normalizeIntentQuery(r?.canonical_title || "");
    const deptNorm = normalizeIntentQuery(r?.department_name || "");
    const inDesignOrProduct = deptNorm.includes("design") || deptNorm.includes("product");
    if (!inDesignOrProduct) return true;
    const hasMobileOwnershipEvidence = MOBILE_PRODUCT_OWNERSHIP_TERMS.some((t) => titleNorm.includes(t));
    const genericDesignOnly = GENERIC_DESIGN_ONLY_TERMS.some((t) => titleNorm.includes(t));
    if (genericDesignOnly && !hasMobileOwnershipEvidence) return false;
    return true;
  });

  return {
    rows: filtered,
    debug: {
      used: true,
      reason: "mobile_product_ownership_filter",
      before: (rows || []).length,
      after: filtered.length
    }
  };
}

function classifyRoleExecutionFamily(r) {
  const title = normalizeIntentQuery(r?.canonical_title || "");
  const dept = normalizeIntentQuery(r?.department_name || "");
  return {
    backend: dept.includes("engineering") && (title.includes("backend") || title.includes("integration") || title.includes("api") || title.includes("platform") || title.includes("data engineer")),
    frontend: dept.includes("engineering") && (title.includes("frontend") || title.includes("web")),
    mobile_ui: (dept.includes("engineering") || dept.includes("design") || dept.includes("product")) && (title.includes("mobile") || title.includes("react native") || title.includes("flutter") || title.includes("ui") || title.includes("ux")),
    analytics: dept.includes("data") || title.includes("analyst") || title.includes("business intelligence") || title.includes("bi"),
    infrastructure: dept.includes("engineering") && (title.includes("platform") || title.includes("sre") || title.includes("devops") || title.includes("infrastructure")),
    product_design: (dept.includes("design") || dept.includes("product")) && (title.includes("product") || title.includes("ux") || title.includes("ui") || title.includes("designer")),
    people_ops: dept.includes("hr") || title.includes("people") || title.includes("talent") || title.includes("hr "),
    support: title.includes("support") || title.includes("helpdesk") || title.includes("customer success"),
    document: title.includes("writer") || title.includes("documentation"),
    test: title.includes("qa") || title.includes("test")
  };
}

function scoreWithIntentPriors(rows, intentCtx, ownershipCtx = null) {
  const activePriors = intentCtx.activePriors || [];
  const exec = intentCtx.executionIntent || { acts: [], surfaces: [], ownershipIntensity: "low" };
  if (!rows.length) return rows;

  const rescored = rows.map((r) => {
    const titleNorm = normalizeIntentQuery(r?.canonical_title || "");
    const deptNorm = normalizeIntentQuery(r?.department_name || "");
    const whyNorm = normalizeIntentQuery(r?.why_matched || "");
    const base = Math.max(0, Math.min(1, Number(r?.final_score || 0)));

    let priorBoost = 0;
    let suppression = 0;
    let activeSignals = 0;
    const fam = classifyRoleExecutionFamily(r);
    for (const prior of activePriors) {
      const roleHit = containsAny(titleNorm, prior.includeRoleTokens);
      const deptHit = (prior.includeDepts || []).some((d) => deptNorm.includes(normalizeIntentQuery(d)));
      const suppressHit = containsAny(titleNorm, prior.suppressRoleTokens);
      if (roleHit) {
        priorBoost += 0.24;
        activeSignals += 1;
      }
      if (deptHit) {
        priorBoost += 0.12;
        activeSignals += 1;
      }
      if (suppressHit) suppression += 0.22;
    }

    // Bounded execution-surface ownership alignment (recovery sprint scope only).
    let executionSurfaceBoost = 0;
    let executionSuppression = 0;
    if (exec.surfaces.includes("backend")) {
      if (fam.backend || fam.infrastructure) executionSurfaceBoost += 0.24;
      if (fam.support || fam.document || fam.test || fam.mobile_ui) executionSuppression += 0.24;
    }
    if (exec.surfaces.includes("analytics")) {
      if (fam.analytics) executionSurfaceBoost += 0.22;
      if (fam.support || fam.people_ops) executionSuppression += 0.12;
    }
    if (exec.surfaces.includes("mobile_ui") || exec.surfaces.includes("product_design")) {
      if (fam.mobile_ui || fam.product_design) executionSurfaceBoost += 0.24;
      const titleNorm = normalizeIntentQuery(r?.canonical_title || "");
      const genericDesign = titleNorm.includes("brand") || titleNorm.includes("curriculum") || titleNorm.includes("graphic");
      if (genericDesign) executionSuppression += 0.22;
      if (fam.backend || fam.infrastructure) executionSuppression += 0.12;
    }
    if (exec.ownershipIntensity === "high") {
      if (fam.support || fam.document || fam.test) executionSuppression += 0.08;
    }

    // Penalize generic overlap-only matches when role-family intent signals are absent.
    const genericWhy = /(semantic match via|keywords|search phrases|overlap)/i.test(whyNorm);
    if (genericWhy && activeSignals === 0 && base < 0.55) suppression += 0.08;

    const mskills = Number(r?.matched_skill_count || 0);
    const ownAdj = ownershipScoreAdjustments(r, ownershipCtx, {
      requiredHitCount: mskills > 0 ? 1 : 0,
      niceHitCount: mskills > 1 ? 1 : 0
    });

    // Score spread amplification:
    // - boost separation at top-end
    // - compress weak/noisy lower end
    const preSpread = Math.max(
      0,
      Math.min(1, base + priorBoost + executionSurfaceBoost + ownAdj.boost - suppression - executionSuppression - ownAdj.penalty)
    );
    const spread = preSpread >= 0.5 ? Math.pow(preSpread, 0.72) : Math.pow(preSpread, 1.35);
    const final = Math.max(0, Math.min(1, spread));

    return {
      ...r,
      final_score: final,
      confidence: mapConfidence(final),
      _intent_rank_debug: {
        base,
        priorBoost,
        executionSurfaceBoost,
        executionSuppression,
        suppression,
        activeSignals,
        executionIntent: exec,
        roleFamily: fam,
        spreadIn: preSpread,
        spreadOut: final,
        ownership: ownershipCtx
          ? { rules: ownershipCtx.ruleIds || [], boost: ownAdj.boost, penalty: ownAdj.penalty }
          : null
      }
    };
  });

  return rescored.sort((a, b) =>
    Number(b?.final_score || 0) - Number(a?.final_score || 0) ||
    String(a?.canonical_title || "").localeCompare(String(b?.canonical_title || ""))
  );
}

async function fallbackIntentPriorSearch(sb, normalizedQuery, intentCtx, limitCount) {
  if (!(intentCtx.activePriors || []).length) return { rows: [], debug: { used: false, reason: "no_active_priors" } };
  const active = intentCtx.activePriors;
  const includeDepts = [...new Set(active.flatMap((p) => p.includeDepts || []).map((d) => normalizeIntentQuery(d)))];
  const includeTokens = [...new Set(active.flatMap((p) => p.includeRoleTokens || []).map((t) => normalizeIntentQuery(t)))];
  const suppressTokens = [...new Set(active.flatMap((p) => p.suppressRoleTokens || []).map((t) => normalizeIntentQuery(t)))];
  const signalTokens = (intentCtx.expandedTokens || []).map((t) => normalizeIntentQuery(t)).filter(Boolean);

  const [rolesRes, metaRes] = await Promise.all([
    sb.from("roles_v2").select("id, canonical_title, role_family, hint, active").eq("active", true),
    sb.from("role_semantic_metadata").select("role_id, keywords, search_phrases, responsibilities, work_examples, tools, output_types")
  ]);
  if (rolesRes.error) throw new Error(rolesRes.error.message || "fallback roles_v2 query failed");
  if (metaRes.error) throw new Error(metaRes.error.message || "fallback role_semantic_metadata query failed");
  const byMeta = new Map((metaRes.data || []).map((m) => [m.role_id, m]));
  const rows = (rolesRes.data || []).map((r) => {
    const titleNorm = normalizeIntentQuery(r.canonical_title || "");
    const deptNorm = normalizeIntentQuery(r.role_family || "");
    const m = byMeta.get(r.id) || {};
    const metaText = normalizeIntentQuery([
      ...(Array.isArray(m.keywords) ? m.keywords : []),
      ...(Array.isArray(m.search_phrases) ? m.search_phrases : []),
      ...(Array.isArray(m.responsibilities) ? m.responsibilities : []),
      ...(Array.isArray(m.work_examples) ? m.work_examples : []),
      ...(Array.isArray(m.tools) ? m.tools : []),
      ...(Array.isArray(m.output_types) ? m.output_types : [])
    ].join(" "));
    const deptHit = includeDepts.some((d) => deptNorm.includes(d));
    const roleHit = includeTokens.some((t) => titleNorm.includes(t));
    const suppressed = suppressTokens.some((t) => titleNorm.includes(t));
    const tokenHits = signalTokens.filter((t) => t && (titleNorm.includes(t) || metaText.includes(t))).length;
    const tokenRatio = tokenHits / Math.max(1, signalTokens.length);
    if (!deptHit && !roleHit && tokenRatio < 0.25) return null;
    let score = (deptHit ? 0.32 : 0) + (roleHit ? 0.34 : 0) + (tokenRatio * 0.34);
    if (suppressed) score -= 0.26;
    score = Math.max(0, Math.min(1, score));
    if (score < 0.2) return null;
    return {
      role_id: r.id,
      canonical_title: r.canonical_title,
      department_name: r.role_family || "General",
      level_code: "L2",
      level_display: "Mid",
      final_score: score,
      confidence: mapConfidence(score),
      hint: r.hint || "",
      required_skills: [],
      good_to_have: [],
      aliases: [],
      matched_skills: [],
      missing_skills: [],
      matched_skill_count: 0,
      missing_skill_count: 0,
      why_matched: "Intent-prior fallback match via family + role semantics.",
      semantic_terms: signalTokens,
      percentile_25: null,
      percentile_75: null,
      benchmark_currency: "INR",
      salary_display: ""
    };
  }).filter(Boolean)
    .sort((a, b) => Number(b.final_score || 0) - Number(a.final_score || 0) || String(a.canonical_title || "").localeCompare(String(b.canonical_title || "")))
    .slice(0, Math.min(Math.max(1, Number(limitCount || 10)), 50));
  return { rows, debug: { used: true, includeDepts, includeTokens, suppressTokens, signalTokensCount: signalTokens.length, candidateCount: rows.length } };
}

export async function semanticIntentEngine(params) {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  const shouldLogDebug = process.env.NODE_ENV !== "production" && !!params?.includeDebug;

  const normalizedQuery = normalizeIntentQuery(params.rawQuery);
  const rawTokens = normalizedQuery.split(" ").filter(Boolean);
  const stopWords = new Set([
    "a","an","the","and","or","for","with","without","to","of","in","on","at","by","from",
    "someone","who","can","could","need","needs","want","wants","looking","hire","hiring",
    "person","people","role","job","create","build","make","do","does","able"
  ]);
  const filteredTokens = rawTokens.filter((t) => t.length >= 2 && !stopWords.has(t));
  const stopWordFilteredOut = rawTokens.filter((t) => stopWords.has(t) || t.length < 2);

  const startedAt = Date.now();
  if (shouldLogDebug) {
    console.info("[semanticIntentEngine] raw tokens", rawTokens);
    console.info("[semanticIntentEngine] filtered stop-word tokens", filteredTokens);
    console.info("[semanticIntentEngine] removed stop-word tokens", stopWordFilteredOut);
  }

  const [{ data: metadataRows, error: metadataErr }, { data: intentCanonicalRows }, { data: intentAliasRows }] =
    await Promise.all([
      sb
        .from("role_semantic_metadata")
        .select("role_id, keywords, search_phrases, responsibilities, work_examples, tools, output_types")
        .limit(2000),
      sb.from("skills_v2").select("id, canonical_name"),
      sb.from("skill_aliases").select("skill_id, alias")
    ]);
  if (metadataErr && shouldLogDebug) console.warn("[semanticIntentEngine] metadata probe failed", metadataErr.message || metadataErr);
  const metadataCoverage = {
    totalRows: Array.isArray(metadataRows) ? metadataRows.length : 0,
    withKeywords: (metadataRows || []).filter((r) => Array.isArray(r.keywords) ? r.keywords.length : !!r.keywords).length,
    withSearchPhrases: (metadataRows || []).filter((r) => Array.isArray(r.search_phrases) ? r.search_phrases.length : !!r.search_phrases).length,
    withResponsibilities: (metadataRows || []).filter((r) => Array.isArray(r.responsibilities) ? r.responsibilities.length : !!r.responsibilities).length
  };

  const intentAliasIdx = buildSkillAliasIndexes(intentCanonicalRows || [], intentAliasRows || []);
  const intentConceptResolution = resolveProfessionalConcepts(
    [normalizedQuery, String(params.rawQuery || ""), ...(Array.isArray(params.skills) ? params.skills : [])].filter(
      Boolean
    ),
    intentAliasIdx
  );
  const intentInputText = [normalizedQuery, ...intentConceptResolution.resolvedCanonicalLower]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const canonicalDerivedTokens = [
    ...new Set(
      (intentConceptResolution.resolvedCanonicalLower || []).flatMap((c) =>
        String(c || "")
          .split(/\s+/)
          .map((w) => w.trim())
          .filter((w) => w.length >= 2 && !stopWords.has(w))
      )
    )
  ];
  const filteredTokensForIntent = [...new Set([...filteredTokens, ...canonicalDerivedTokens])];

  const { data, error } = await sb.rpc("search_roles_intent_v1", {
    input_text: intentInputText,
    selected_department: params.selectedDepartment || null,
    currency: params.currency || "INR",
    limit_count: params.limitCount || 10
  });

  if (error) throw new Error(error.message || "search_roles_intent_v1 failed");
  const rawResults = Array.isArray(data) ? data : [];
  const intentCtx = computeIntentContext(intentInputText, filteredTokensForIntent);
  const executionIntent = inferExecutionIntent(intentInputText, intentCtx.expandedTokens);
  let fallbackPrior = { rows: [], debug: { used: false, reason: "not_checked" } };
  if (!rawResults.length) {
    fallbackPrior = await fallbackIntentPriorSearch(sb, intentInputText, intentCtx, params.limitCount || 10);
  }
  const retrievalEnrichment = await enrichIntentCandidates(
    sb,
    intentInputText,
    filteredTokensForIntent,
    intentCtx,
    executionIntent,
    params.limitCount || 10
  );
  let skillGraphIntentRows = [];
  if (intentConceptResolution.resolvedSkillIds?.length) {
    const graphPack = await fetchSkillGraphRoleRows(sb, {
      canonicalSkillIds: intentConceptResolution.resolvedSkillIds,
      normalizedSkills: filteredTokensForIntent,
      selectedDepartment: params.selectedDepartment || null,
      limitCount: params.limitCount || 10,
      currency: params.currency || "INR",
      minScore: 0.06
    });
    skillGraphIntentRows = graphPack.results || [];
  }
  const mergedRawPreFilter = dedupeIntentResults(
    [
      ...(rawResults.length ? rawResults : fallbackPrior.rows),
      ...(retrievalEnrichment.rows || []),
      ...skillGraphIntentRows
    ],
    50
  );
  const mobileRefinement = refineMobileProductCandidates(mergedRawPreFilter, intentInputText, intentCtx.expandedTokens);
  const deduped = dedupeIntentResults(mobileRefinement.rows || [], 50);
  const intentDbOwnership = await fetchOwnershipFamiliesFromSkillIds(sb, intentConceptResolution.resolvedSkillIds);
  const ownershipMerged = mergePhraseAndDbOwnership(
    resolveOwnershipContext(intentInputText, intentConceptResolution.resolvedCanonicalLower),
    intentDbOwnership
  );
  const rescored = scoreWithIntentPriors(deduped, { ...intentCtx, executionIntent }, ownershipMerged);
  const results = rescored.slice(0, Math.min(Math.max(1, Number(params.limitCount || 10)), 50));
  const scoreBreakdown = results.slice(0, 5).map((r) => ({
    role_id: r?.role_id || null,
    title: r?.canonical_title || "",
    final_score: Number(r?.final_score || 0),
    confidence: r?.confidence || "",
    why_matched: r?.why_matched || ""
  }));
  if (shouldLogDebug) {
    console.info("[semanticIntentEngine] intent_input_text", intentInputText);
    console.info("[semanticIntentEngine] semantic_terms", filteredTokensForIntent);
    console.info("[semanticIntentEngine] metadata category coverage", metadataCoverage);
    console.info("[semanticIntentEngine] score breakdown (top 5)", scoreBreakdown);
    console.info("[semanticIntentEngine] candidate role count", results.length);
    console.info("[semanticIntentEngine] dedupe reduction", { before: rawResults.length, after: deduped.length });
    console.info("[semanticIntentEngine] active intent priors", intentCtx.activePriors.map((p) => p.name));
    console.info("[semanticIntentEngine] prior checks", intentCtx.priorChecks);
    console.info("[semanticIntentEngine] prior fallback", fallbackPrior.debug);
    console.info("[semanticIntentEngine] retrieval enrichment", retrievalEnrichment.debug);
    console.info("[semanticIntentEngine] mobile refinement", mobileRefinement.debug);
    console.info("[semanticIntentEngine] execution intent", executionIntent);
  }

  const detectedSkills = [
    ...new Set([
      ...(Array.isArray(params.skills) ? params.skills.map((s) => normalizeIntentQuery(String(s))) : []),
      ...intentConceptResolution.resolvedCanonicalLower
    ])
  ].filter(Boolean);

  return {
    workflowType: "intent",
    normalizedQuery: intentInputText,
    detectedSkills,
    inferredRoleIds: results.map((r) => r?.role_id).filter(Boolean),
    results,
    responseTimeMs: Date.now() - startedAt,
    debug: {
      rawTokens,
      filteredTokens,
      stopWordFilteredOut,
      semanticTerms: filteredTokensForIntent,
      normalizedQueryPreAlias: normalizedQuery,
      intentSkillResolution: {
        resolvedCanonicals: intentConceptResolution.resolvedCanonicalLower,
        resolvedSkillIds: intentConceptResolution.resolvedSkillIds
      },
      tokenization: {
        rawTokens,
        filteredTokens,
        filteredTokensForIntent,
        canonicalDerivedTokens,
        stopWordFilteredOut
      },
      synonymExpansion: {
        expandedTokens: intentCtx.expandedTokens,
        expandedQuery: intentCtx.expandedQuery
      },
      priorChecks: intentCtx.priorChecks,
      executionIntent,
      metadataCoverage,
      dedupe: { before: rawResults.length, after: deduped.length },
      priorFallback: fallbackPrior.debug,
      skillGraphCandidates: skillGraphIntentRows.length,
      retrievalEnrichment: retrievalEnrichment.debug,
      mobileRefinement: mobileRefinement.debug,
      intentPriors: intentCtx.activePriors.map((p) => p.name),
      candidateCount: results.length,
      scoreBreakdown
    }
  };
}

