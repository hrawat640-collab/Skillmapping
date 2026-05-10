import { getSupabaseAdmin } from "../../supabaseClient.js";

function normalizeSkillQuery(rawQuery, explicitSkills) {
  const fromSkills = Array.isArray(explicitSkills)
    ? explicitSkills.map((s) => String(s || "").toLowerCase().trim()).filter(Boolean)
    : [];
  if (fromSkills.length) return fromSkills.join(" ");
  return String(rawQuery || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSkillList(rawQuery, explicitSkills) {
  const fromSkills = Array.isArray(explicitSkills)
    ? explicitSkills.map((s) => String(s || "").toLowerCase().trim()).filter(Boolean)
    : [];
  if (fromSkills.length) return [...new Set(fromSkills)];
  const q = String(rawQuery || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!q) return [];
  return [...new Set(q.split(" ").map((x) => x.trim()).filter((x) => x.length >= 2))];
}

const SKILL_QUERY_ALIASES = {
  sde: "rest apis",
  sde1: "rest apis",
  sde2: "rest apis",
  swe: "javascript",
  swe1: "javascript",
  swe2: "javascript",
  sse: "rest apis",
  fullstack: "javascript",
  "full-stack": "javascript",
  "backend dev": "rest apis",
  "frontend dev": "react",
  ml: "machine learning",
  ai: "llms",
  bi: "tableau",
  pm: "product strategy",
  ux: "ux design",
  ui: "ui design"
};

function mapConfidence(score) {
  if (score >= 0.7) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

const BROAD_COMMON_SKILLS = new Set([
  "python","excel","sql","communication","analytics","analysis","data analysis","problem solving",
  "teamwork","presentation","powerpoint","documentation","reporting"
]);

const HIGH_SPECIFICITY_TOOLS = new Set([
  "kafka","kubernetes","docker","terraform","redis","postgresql","snowflake","dbt","airflow",
  "tableau","power bi","looker","salesforce","sap","blender","figma","spark","hadoop"
]);

const TYPO_NORMALIZATION = {
  reactjs: "react",
  react_js: "react",
  hrpb: "hrbp",
  swe: "software engineer"
};

function normalizeToken(raw) {
  const cleaned = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return TYPO_NORMALIZATION[cleaned] || cleaned;
}

function normalizeList(list) {
  return [...new Set((list || []).map((x) => normalizeToken(x)).filter(Boolean))];
}

function expandSkillAliases(normalizedSkills) {
  const out = new Set(normalizedSkills || []);
  for (const s of normalizedSkills || []) {
    const alias = SKILL_QUERY_ALIASES[s];
    if (alias) out.add(normalizeToken(alias));
  }
  return [...out];
}

function isSpecificSkillToken(token) {
  if (!token) return false;
  if (HIGH_SPECIFICITY_TOOLS.has(token)) return true;
  for (const t of HIGH_SPECIFICITY_TOOLS) {
    if (token.includes(t) || t.includes(token)) return true;
  }
  return false;
}

function rerankStructuredResults(rows, normalizedSkills) {
  const userSkills = expandSkillAliases(normalizeList(normalizedSkills || []));
  const userSet = new Set(userSkills);
  if (!rows.length || !userSkills.length) return rows;

  const backendAffinitySignals = new Set(["kafka","kubernetes","docker","redis","rest apis","microservices","postgresql","node js","java","spring","go"]);
  const backendAffinity = userSkills.some((s) => {
    if (backendAffinitySignals.has(s)) return true;
    for (const t of backendAffinitySignals) if (s.includes(t) || t.includes(s)) return true;
    return false;
  });
  const distributedSignal = userSkills.some((s) => s.includes("kafka") || s.includes("distributed") || s.includes("microservices"));

  const rescored = rows.map((row) => {
    const required = normalizeList(row?.required_skills || []);
    const nice = normalizeList(row?.good_to_have || []);
    const matched = normalizeList(row?.matched_skills || []);
    const requiredSet = new Set(required);
    const niceSet = new Set(nice);

    const requiredHits = userSkills.filter((s) => requiredSet.has(s));
    const niceHits = userSkills.filter((s) => !requiredSet.has(s) && niceSet.has(s));
    const matchedHits = userSkills.filter((s) => matched.includes(s) || requiredSet.has(s) || niceSet.has(s));
    const specificityHits = userSkills.filter((s) => isSpecificSkillToken(s));
    const broadHits = userSkills.filter((s) => BROAD_COMMON_SKILLS.has(s));
    const titleNorm = normalizeToken(row?.canonical_title || "");
    const deptNorm = normalizeToken(row?.department_name || "");
    const backendFamilyHit =
      backendAffinity &&
      (
        deptNorm.includes("engineering") ||
        titleNorm.includes("backend") ||
        titleNorm.includes("platform") ||
        titleNorm.includes("integration") ||
        titleNorm.includes("api") ||
        titleNorm.includes("data engineer")
      );
    const noisyFamilyHit =
      backendAffinity &&
      (
        titleNorm.includes("qa") ||
        titleNorm.includes("quality assurance") ||
        titleNorm.includes("technical support") ||
        titleNorm.includes("support") ||
        deptNorm.includes("support")
      );
    const analyticsLikeTitle =
      titleNorm.includes("analytics") ||
      titleNorm.includes("analyst") ||
      titleNorm.includes("scientist") ||
      titleNorm.includes("nlp") ||
      titleNorm.includes("computer vision");
    const coreBackendTitle =
      titleNorm.includes("backend") ||
      titleNorm.includes("platform") ||
      titleNorm.includes("integration") ||
      titleNorm.includes("api") ||
      titleNorm.includes("data engineer");

    const reqRatio = requiredHits.length / Math.max(1, userSkills.length);
    const specRatio = specificityHits.length / Math.max(1, userSkills.length);
    const semanticAdjRatio = matchedHits.length / Math.max(1, userSkills.length);
    const niceRatio = niceHits.length / Math.max(1, userSkills.length);
    const broadRatio = broadHits.length / Math.max(1, userSkills.length);

    // Must-have intent dominance: required match dominates rank.
    const requiredDominant = (reqRatio * 0.66);
    const specificityBoost = (specRatio * 0.21);
    const semanticAdj = (semanticAdjRatio * 0.09);
    const niceContribution = (niceRatio * 0.04);
    const broadPenalty = (broadRatio * 0.08);
    const familyBoost = backendFamilyHit ? 0.14 : 0;
    const noisySuppression = noisyFamilyHit ? 0.18 : 0;
    const distributedMismatchSuppression = distributedSignal && analyticsLikeTitle && !coreBackendTitle ? 0.22 : 0;
    const base = Number(row?.final_score || 0);
    const rankScore = Math.max(
      0,
      Math.min(
        1,
        requiredDominant + specificityBoost + semanticAdj + niceContribution + familyBoost + (base * 0.08) - broadPenalty - noisySuppression
        - distributedMismatchSuppression
      )
    );

    const requiredMissPenalty = requiredHits.length === 0 ? 0.14 : 0;
    const adjusted = Math.max(0, Math.min(1, rankScore - requiredMissPenalty));

    return {
      ...row,
      final_score: adjusted,
      confidence: mapConfidence(adjusted),
      _rank_debug: {
        base,
        reqRatio,
        specRatio,
        semanticAdjRatio,
        niceRatio,
        broadRatio,
        backendFamilyHit,
        noisyFamilyHit,
        distributedMismatchSuppression,
        requiredHits: requiredHits.length,
        niceHits: niceHits.length
      }
    };
  });

  return rescored.sort((a, b) =>
    Number(b.final_score || 0) - Number(a.final_score || 0) ||
    Number(b.matched_skill_count || 0) - Number(a.matched_skill_count || 0) ||
    String(a.canonical_title || "").localeCompare(String(b.canonical_title || ""))
  );
}

async function fallbackDeterministicSkillSearch(sb, { canonicalSkillIds, normalizedSkills, selectedDepartment, limitCount, currency }) {
  if (!canonicalSkillIds.length) return { results: [], debug: { fallbackUsed: true, reason: "no_canonical_skills" } };

  const [{ data: roleSkillsRows, error: roleSkillsErr }, { data: skillsRows, error: skillsErr }, { data: rolesRows, error: rolesErr }, { data: aliasesRows, error: aliasesErr }, { data: levelsRows, error: levelsErr }] =
    await Promise.all([
      sb.from("role_skills").select("role_id, skill_id, importance, weight"),
      sb.from("skills_v2").select("id, canonical_name"),
      sb.from("roles_v2").select("id, canonical_title, role_family, hint, active").eq("active", true),
      sb.from("role_aliases").select("role_id, alias"),
      sb.from("role_levels_valid").select("role_id, level_code, min_exp, max_exp")
    ]);

  if (roleSkillsErr) throw new Error(roleSkillsErr.message || "role_skills fallback query failed");
  if (skillsErr) throw new Error(skillsErr.message || "skills_v2 fallback query failed");
  if (rolesErr) throw new Error(rolesErr.message || "roles_v2 fallback query failed");
  if (aliasesErr) throw new Error(aliasesErr.message || "role_aliases fallback query failed");
  if (levelsErr) throw new Error(levelsErr.message || "role_levels_valid fallback query failed");

  const skillNameById = new Map((skillsRows || []).map((s) => [s.id, String(s.canonical_name || "").toLowerCase()]));
  const matchedSkillSet = new Set(canonicalSkillIds);
  const roleSkillsByRole = new Map();
  for (const rs of roleSkillsRows || []) {
    const list = roleSkillsByRole.get(rs.role_id) || [];
    list.push(rs);
    roleSkillsByRole.set(rs.role_id, list);
  }
  const aliasesByRole = new Map();
  for (const a of aliasesRows || []) {
    const list = aliasesByRole.get(a.role_id) || [];
    if (a.alias) list.push(String(a.alias));
    aliasesByRole.set(a.role_id, list);
  }
  const levelsByRole = new Map();
  for (const l of levelsRows || []) {
    const list = levelsByRole.get(l.role_id) || [];
    list.push(l);
    levelsByRole.set(l.role_id, list);
  }

  const rows = (rolesRows || [])
    .filter((r) => !selectedDepartment || String(r.role_family || "").toLowerCase() === String(selectedDepartment).toLowerCase())
    .map((role) => {
      const roleSkills = roleSkillsByRole.get(role.id) || [];
      if (!roleSkills.length) return null;
      const totalWeight = roleSkills.reduce((s, x) => s + Number(x.weight || 1), 0);
      const matchedRows = roleSkills.filter((x) => matchedSkillSet.has(x.skill_id));
      if (!matchedRows.length) return null;
      const matchedWeight = matchedRows.reduce((s, x) => s + Number(x.weight || 1), 0);
      const weightedOverlap = totalWeight > 0 ? matchedWeight / totalWeight : 0;
      const coverage = normalizedSkills.length > 0 ? matchedRows.length / normalizedSkills.length : 0;
      const score = Math.min(1, weightedOverlap * 0.75 + coverage * 0.25);
      const requiredRows = roleSkills.filter((x) => x.importance === "required");
      const gthRows = roleSkills.filter((x) => x.importance === "good_to_have");
      const reqHit = requiredRows.filter((x) => matchedSkillSet.has(x.skill_id)).length;
      const gthHit = gthRows.filter((x) => matchedSkillSet.has(x.skill_id)).length;
      const levelList = levelsByRole.get(role.id) || [];
      const level = levelList.find((x) => x.level_code === "L2") || levelList[0] || null;
      const requiredSkills = requiredRows.map((x) => skillNameById.get(x.skill_id)).filter(Boolean);
      const goodToHave = gthRows.map((x) => skillNameById.get(x.skill_id)).filter(Boolean);
      const matchedSkills = matchedRows.map((x) => skillNameById.get(x.skill_id)).filter(Boolean);
      const missingSkills = requiredRows
        .filter((x) => !matchedSkillSet.has(x.skill_id))
        .map((x) => skillNameById.get(x.skill_id))
        .filter(Boolean);
      return {
        role_id: role.id,
        canonical_title: role.canonical_title,
        department_name: role.role_family || "General",
        level_code: level?.level_code || "L2",
        level_display:
          level?.level_code === "L1" ? "Junior" : level?.level_code === "L2" ? "Mid" : level?.level_code === "L3" ? "Senior" : "Lead",
        final_score: score,
        confidence: mapConfidence(score),
        hint: role.hint || "",
        required_skills: requiredSkills,
        good_to_have: goodToHave,
        aliases: aliasesByRole.get(role.id) || [],
        matched_skills: matchedSkills,
        missing_skills: missingSkills,
        matched_skill_count: matchedSkills.length,
        missing_skill_count: missingSkills.length,
        why_matched: `Deterministic weighted overlap. matched_weight=${matchedWeight.toFixed(2)}, total_weight=${totalWeight.toFixed(2)}, req_hit=${reqHit}, gth_hit=${gthHit}`,
        semantic_terms: normalizedSkills,
        percentile_25: null,
        percentile_75: null,
        benchmark_currency: (currency || "INR").toUpperCase(),
        salary_display: "",
        min_exp: level?.min_exp ?? null,
        max_exp: level?.max_exp ?? null
      };
    })
    .filter(Boolean)
    .filter((r) => r.final_score >= 0.12)
    .sort((a, b) => b.final_score - a.final_score || a.canonical_title.localeCompare(b.canonical_title))
    .slice(0, Math.min(Math.max(1, limitCount || 10), 50));

  return {
    results: rows,
    debug: {
      fallbackUsed: true,
      normalizedSkills,
      canonicalSkillIdsCount: canonicalSkillIds.length,
      candidateRoles: rows.length
    }
  };
}

export async function skillSearchEngine(params) {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");
  const shouldLogDebug = process.env.NODE_ENV !== "production" && !!params?.includeDebug;

  const normalizedQuery = normalizeSkillQuery(params.rawQuery, params.skills);
  const normalizedSkills = normalizeSkillList(params.rawQuery, params.skills);
  const skillLookupTokens = normalizedSkills;
  const startedAt = Date.now();

  const [{ data: canonicalSkillRows, error: canonicalErr }, { data: aliasRows, error: aliasErr }] = await Promise.all([
    sb.from("skills_v2").select("id, canonical_name"),
    sb.from("skill_aliases").select("skill_id, alias")
  ]);
  if (canonicalErr) throw new Error(canonicalErr.message || "skills_v2 lookup failed");
  if (aliasErr) throw new Error(aliasErr.message || "skill_aliases lookup failed");

  const canonicalMap = new Map((canonicalSkillRows || []).map((r) => [String(r.canonical_name || "").toLowerCase(), r.id]));
  const aliasMap = new Map((aliasRows || []).map((r) => [String(r.alias || "").toLowerCase(), r.skill_id]));
  const canonicalSkillIds = [...new Set(skillLookupTokens.map((t) => canonicalMap.get(t) || aliasMap.get(t)).filter(Boolean))];

  if (shouldLogDebug) {
    console.info("[skillSearchEngine] normalized skills", normalizedSkills);
    console.info("[skillSearchEngine] canonical skill ids", canonicalSkillIds);
  }

  const { data, error } = await sb.rpc("search_roles_v3", {
    input_text: normalizedQuery,
    selected_department: params.selectedDepartment || null,
    currency: params.currency || "INR",
    limit_count: params.limitCount || 10
  });

  if (error) throw new Error(error.message || "search_roles_v3 failed");
  const rpcResults = Array.isArray(data) ? data : [];
  if (shouldLogDebug) {
    console.info("[skillSearchEngine] rpc candidate count", rpcResults.length);
  }

  let finalResults = rerankStructuredResults(rpcResults, normalizedSkills);
  let fallbackDebug = null;
  if (!finalResults.length) {
    const fallback = await fallbackDeterministicSkillSearch(sb, {
      canonicalSkillIds,
      normalizedSkills,
      selectedDepartment: params.selectedDepartment || null,
      limitCount: params.limitCount || 10,
      currency: params.currency || "INR"
    });
    finalResults = rerankStructuredResults(fallback.results, normalizedSkills);
    fallbackDebug = fallback.debug;
  }

  const matchedRoleSkillsRows = finalResults.reduce((acc, row) => acc + Number(row?.matched_skill_count || 0), 0);
  if (shouldLogDebug) {
    console.info("[skillSearchEngine] matched role_skills rows", matchedRoleSkillsRows);
    console.info("[skillSearchEngine] final candidate count", finalResults.length);
  }

  const debug = {
    normalizedSkills,
    expandedSkillTokens: expandSkillAliases(normalizeList(normalizedSkills || [])),
    canonicalSkillIds,
    rpcCandidateCount: rpcResults.length,
    matchedRoleSkillsRows,
    finalCandidateCount: finalResults.length,
    fallback: fallbackDebug,
    roleSkillClassification: {
      sampleTopResults: finalResults.slice(0, 5).map((r) => {
        const req = normalizeList(r?.required_skills || []);
        const nice = normalizeList(r?.good_to_have || []);
        const matched = normalizeList(r?.matched_skills || []);
        const input = expandSkillAliases(normalizeList(normalizedSkills || []));
        const reqHits = input.filter((s) => req.includes(s));
        const niceHits = input.filter((s) => !req.includes(s) && nice.includes(s));
        return {
          role_id: r?.role_id || null,
          title: r?.canonical_title || "",
          required_count: req.length,
          nice_count: nice.length,
          matched_count: matched.length,
          req_hit_terms: reqHits,
          nice_hit_terms: niceHits,
          req_hit_ratio: reqHits.length / Math.max(1, input.length),
          nice_hit_ratio: niceHits.length / Math.max(1, input.length)
        };
      })
    }
  };

  return {
    workflowType: "structured",
    normalizedQuery,
    detectedSkills: normalizedSkills,
    inferredRoleIds: finalResults.map((r) => r?.role_id).filter(Boolean),
    results: finalResults,
    responseTimeMs: Date.now() - startedAt,
    debug
  };
}

