/**
 * Ownership alignment: (1) phrase rules in OWNERSHIP_RULES, (2) merged with DB-derived
 * role_family priors from skillAliasResolution.fetchOwnershipFamiliesFromSkillIds.
 */

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function paddedHaystack(query, skills) {
  const parts = [String(query || ""), ...(Array.isArray(skills) ? skills : []).map((x) => String(x || ""))];
  const inner = norm(parts.join(" "));
  return ` ${inner} `;
}

/**
 * Longer phrases first so "business intelligence" wins over "business" if both existed.
 * @type {Array<{
 *   id: string,
 *   weight: number,
 *   phrases: string[],
 *   families: string[],
 *   titleHints?: string[],
 *   narrowWithinFamily?: boolean
 * }>}
 */
export const OWNERSHIP_RULES = [
  {
    id: "talent_acquisition",
    weight: 1,
    phrases: ["talent acquisition", "full cycle recruiting", "technical recruiting", "recruiter hiring"],
    families: ["hr"],
    titleHints: ["talent", "recruit", "sourcer", "acquisition"]
  },
  {
    id: "hr_people_ops",
    weight: 1,
    phrases: [
      "employee relations",
      "people partner",
      "hr business partner",
      "people business partner",
      "people operations",
      "hr operations",
      "hr generalist",
      "workforce relations",
      "hrbp"
    ],
    families: ["hr"]
  },
  {
    id: "payroll_ops",
    weight: 0.9,
    phrases: ["payroll operations", "payroll processing"],
    families: ["hr", "finance", "operations"]
  },
  {
    id: "learning_development",
    weight: 0.9,
    phrases: ["learning and development", "instructional design", "training design", "l and d"],
    families: ["learning", "hr"]
  },
  {
    id: "business_intelligence",
    weight: 1,
    phrases: ["business intelligence", "bi reporting", "bi dashboard", "enterprise reporting"],
    families: ["data"],
    titleHints: ["bi ", "business intelligence", "analytics", "reporting"],
    narrowWithinFamily: true
  },
  {
    id: "data_engineering",
    weight: 1,
    phrases: ["data engineering", "data pipeline", "etl pipeline", "data warehouse"],
    families: ["data", "engineering"],
    titleHints: ["data engineer", "etl", "pipeline", "warehouse"],
    narrowWithinFamily: true
  },
  {
    id: "machine_learning",
    weight: 1,
    phrases: ["machine learning", "deep learning", "computer vision", "nlp model", "llm fine"],
    families: ["data", "engineering"],
    titleHints: ["machine learning", "ml engineer", "research scientist", "nlp", "deep learning", "ai engineer"],
    narrowWithinFamily: true
  },
  {
    id: "product_management",
    weight: 1,
    phrases: ["product management", "product strategy", "product discovery", "product roadmap"],
    families: ["product"],
    titleHints: ["product manager", "product owner", "apm", "gpm"]
  },
  {
    id: "ux_research",
    weight: 1,
    phrases: ["ux research", "user research", "usability testing", "design research"],
    families: ["design", "product"],
    titleHints: ["research", "ux", "design"]
  },
  {
    id: "performance_marketing",
    weight: 1,
    phrases: ["performance marketing", "paid acquisition", "paid media", "growth marketing", "ppc marketing"],
    families: ["marketing"],
    titleHints: ["performance", "growth", "paid", "sem", "ppc"]
  },
  {
    id: "brand_strategy",
    weight: 0.9,
    phrases: ["brand strategy", "brand marketing", "brand positioning"],
    families: ["marketing"],
    titleHints: ["brand", "creative"]
  },
  {
    id: "backend_engineering",
    weight: 1,
    phrases: ["backend engineering", "backend development", "server side", "server-side development", "api development"],
    families: ["engineering"],
    titleHints: ["backend", "platform", "integration", "api", "microservice", "services"],
    narrowWithinFamily: true
  },
  {
    id: "mobile_development",
    weight: 1,
    phrases: [
      "mobile app development",
      "mobile development",
      "react native",
      "flutter development",
      "ios development",
      "android development"
    ],
    families: ["engineering"],
    titleHints: ["mobile", "react native", "flutter", "ios", "android", "swift", "kotlin"],
    narrowWithinFamily: true
  },
  {
    id: "devops_sre",
    weight: 1,
    phrases: ["site reliability", "devops engineer", "infrastructure engineer", "platform reliability", "ci cd"],
    families: ["engineering"],
    titleHints: ["devops", "sre", "reliability", "infrastructure", "platform", "kubernetes"],
    narrowWithinFamily: true
  },
  {
    id: "customer_success",
    weight: 1,
    phrases: ["customer success", "client success", "account management", "customer retention", "renewals"],
    families: ["marketing", "operations", "salesforce"],
    titleHints: ["customer success", "account manager", "client success", "csm"]
  },
  {
    id: "sales_revenue",
    weight: 1,
    phrases: ["enterprise sales", "b2b sales", "account executive", "sales development", "business development"],
    families: ["marketing", "salesforce", "operations"],
    titleHints: ["sales", "account executive", "bdr", "sdr", "revenue"]
  },
  {
    id: "financial_planning",
    weight: 1,
    phrases: ["financial planning", "fp&a", "budget planning", "forecasting finance"],
    families: ["finance"],
    titleHints: ["fp&a", "financial planning", "finance analyst", "finance manager"]
  },
  {
    id: "legal_compliance",
    weight: 1,
    phrases: ["legal counsel", "regulatory compliance", "compliance management", "gdpr compliance"],
    families: ["legal"],
    titleHints: ["legal", "counsel", "compliance"]
  },
  {
    id: "support_operations",
    weight: 0.85,
    phrases: ["technical support", "help desk", "customer support", "service desk"],
    families: ["operations", "salesforce"],
    titleHints: ["support", "helpdesk", "service desk"]
  }
];

export function resolveOwnershipContext(normalizedQuery, skills) {
  const hay = paddedHaystack(normalizedQuery || "", skills || []);
  const matched = [];
  for (const rule of OWNERSHIP_RULES) {
    const phrases = [...(rule.phrases || [])].sort((a, b) => b.length - a.length);
    for (const p of phrases) {
      const needle = ` ${norm(p)} `;
      if (hay.includes(needle)) {
        matched.push(rule);
        break;
      }
    }
  }
  if (!matched.length) return null;
  const ownerFamilies = new Set();
  let maxW = 0;
  for (const r of matched) {
    (r.families || []).forEach((f) => ownerFamilies.add(String(f).toLowerCase()));
    maxW = Math.max(maxW, Number(r.weight) || 1);
  }
  return {
    matchedRules: matched,
    ownerFamilies,
    strength: Math.min(1, maxW),
    ruleIds: matched.map((r) => r.id)
  };
}

/** Merge phrase-based ownership with DB role_family priors from resolved skill ids. */
export function mergePhraseAndDbOwnership(phraseCtx, dbCtx) {
  if (!phraseCtx && !dbCtx) return null;
  const ownerFamilies = new Set();
  if (phraseCtx?.ownerFamilies) phraseCtx.ownerFamilies.forEach((f) => ownerFamilies.add(f));
  if (dbCtx?.ownerFamilies) dbCtx.ownerFamilies.forEach((f) => ownerFamilies.add(f));
  const matchedRules = phraseCtx?.matchedRules ? [...phraseCtx.matchedRules] : [];
  const ruleIds = [...(phraseCtx?.ruleIds || [])];
  if (dbCtx?.ruleIds?.length) {
    for (const id of dbCtx.ruleIds) {
      if (!ruleIds.includes(id)) ruleIds.push(id);
    }
  }
  let strength = (phraseCtx?.strength || 0) + (dbCtx?.strength ? dbCtx.strength * 0.52 : 0);
  if (strength <= 0) strength = dbCtx?.strength || phraseCtx?.strength || 0.72;
  strength = Math.min(1, strength);

  return {
    matchedRules,
    ownerFamilies,
    strength,
    ruleIds,
    _sources: { phrase: !!phraseCtx, db: !!dbCtx }
  };
}

/**
 * @returns {{ aligned: boolean, nearMiss: boolean }}
 */
export function evaluateOwnershipForRow(row, ctx) {
  if (!ctx) return { aligned: false, nearMiss: false };
  const dept = norm(row?.department_name || "");
  const title = norm(row?.canonical_title || "");
  let aligned = false;
  let nearMiss = false;

  for (const rule of ctx.matchedRules || []) {
    const famHit = (rule.families || []).some((f) => dept.includes(f) || dept === f);
    const titleHit = (rule.titleHints || []).some((h) => title.includes(norm(h)));

    if (rule.narrowWithinFamily) {
      const hints = rule.titleHints || [];
      if (famHit && (!hints.length || titleHit)) aligned = true;
      else if (famHit && hints.length && !titleHit) nearMiss = true;
      continue;
    }
    if (famHit || titleHit) aligned = true;
  }

  if (!aligned && ctx.ownerFamilies && ctx.ownerFamilies.size) {
    const famHit = [...ctx.ownerFamilies].some((f) => dept.includes(f) || dept === f);
    if (famHit) aligned = true;
  }

  return { aligned, nearMiss };
}

export function ownershipScoreAdjustments(row, ctx, { requiredHitCount = 0, niceHitCount = 0 } = {}) {
  if (!ctx) return { boost: 0, penalty: 0 };
  const { aligned, nearMiss } = evaluateOwnershipForRow(row, ctx);
  const s = ctx.strength || 1;
  if (aligned) {
    return { boost: 0.1 + 0.06 * Math.min(1, requiredHitCount * 0.15), penalty: 0 };
  }
  if (nearMiss) {
    return { boost: 0, penalty: 0.11 * s };
  }
  if (requiredHitCount === 0 && niceHitCount <= 1) {
    return { boost: 0, penalty: 0.14 * s };
  }
  if (requiredHitCount === 0) {
    return { boost: 0, penalty: 0.08 * s };
  }
  return { boost: 0, penalty: 0 };
}

/** Title-mode: small nudge when query contains ownership phrase and role family aligns */
export function ownershipTitleDeptBoost(row, ctx) {
  if (!ctx) return 0;
  const { aligned } = evaluateOwnershipForRow(row, ctx);
  return aligned ? 0.12 * ctx.strength : 0;
}
