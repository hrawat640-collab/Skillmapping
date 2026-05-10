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
import { fetchSkillGraphRoleRows, mergeRpcAndGraphCandidates } from "./skillGraphRetrieval.js";

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

/** Fallback only when skill_aliases has no row; prefer DB. */
const SKILL_QUERY_ALIASES = Object.freeze({});

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

/** True if user-entered skill phrase aligns with a catalog skill (exact, substring, or shared meaningful tokens). */
function userSkillTouchesCatalogSkill(userSkill, catalogSkill) {
  const u = normalizeToken(userSkill);
  const c = normalizeToken(catalogSkill);
  if (!u || !c) return false;
  if (u === c) return true;
  if (c.includes(u) || u.includes(c)) return true;
  const uWords = u.split(" ").filter((w) => w.length > 2);
  const cWords = c.split(" ").filter((w) => w.length > 2);
  if (!uWords.length || !cWords.length) return false;
  const cSet = new Set(cWords);
  return uWords.some((w) => cSet.has(w));
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

function rerankStructuredResults(rows, normalizedSkills, options = {}) {
  const normalizedQueryOpt = String(options.normalizedQuery || "");
  const ownershipQuery = [normalizedQueryOpt, ...(Array.isArray(normalizedSkills) ? normalizedSkills : [])]
    .filter(Boolean)
    .join(" ");
  const ownershipCtx =
    options.ownershipCtx != null ? options.ownershipCtx : resolveOwnershipContext(ownershipQuery, []);
  const combinedForRank = [...(normalizedSkills || []), ...(options.dbCanonicalExtras || [])];
  const userSkills = expandSkillAliases(normalizeList(combinedForRank));
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

    const requiredHits = userSkills.filter((s) => required.some((r) => userSkillTouchesCatalogSkill(s, r)));
    const niceHits = userSkills.filter(
      (s) => !required.some((r) => userSkillTouchesCatalogSkill(s, r)) && nice.some((n) => userSkillTouchesCatalogSkill(s, n))
    );
    const matchedHits = userSkills.filter((s) =>
      matched.some((m) => userSkillTouchesCatalogSkill(s, m)) ||
      required.some((r) => userSkillTouchesCatalogSkill(s, r)) ||
      nice.some((n) => userSkillTouchesCatalogSkill(s, n))
    );
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

    const userTouchesRequired =
      required.length === 0 || userSkills.some((s) => required.some((r) => userSkillTouchesCatalogSkill(s, r)));
    const requiredMissPenalty = !userTouchesRequired ? 0.14 : 0;
    const ownAdj = ownershipScoreAdjustments(row, ownershipCtx, {
      requiredHitCount: requiredHits.length,
      niceHitCount: niceHits.length
    });
    const adjusted = Math.max(
      0,
      Math.min(1, rankScore + ownAdj.boost - ownAdj.penalty - requiredMissPenalty)
    );

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
        niceHits: niceHits.length,
        ownership: { boost: ownAdj.boost, penalty: ownAdj.penalty, rules: ownershipCtx?.ruleIds || [] }
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
  const { results, debug } = await fetchSkillGraphRoleRows(sb, {
    canonicalSkillIds,
    normalizedSkills,
    selectedDepartment,
    limitCount,
    currency,
    minScore: 0.12
  });
  return {
    results,
    debug: { fallbackUsed: true, normalizedSkills, ...debug }
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
  const aliasIdx = buildSkillAliasIndexes(canonicalSkillRows || [], aliasRows || []);
  const conceptResolution = resolveProfessionalConcepts(
    [...normalizedSkills, normalizedQuery, String(params.rawQuery || "")].filter(Boolean),
    aliasIdx
  );
  const enrichedQuery = [normalizedQuery, ...conceptResolution.resolvedCanonicalLower]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const canonicalSkillIds = [
    ...new Set([
      ...skillLookupTokens.map((t) => canonicalMap.get(t) || aliasMap.get(t)).filter(Boolean),
      ...conceptResolution.resolvedSkillIds
    ])
  ];

  const dbOwnership = await fetchOwnershipFamiliesFromSkillIds(sb, canonicalSkillIds);
  const ownershipPhrase = resolveOwnershipContext(
    [enrichedQuery, ...normalizedSkills].filter(Boolean).join(" "),
    []
  );
  const ownershipMerged = mergePhraseAndDbOwnership(ownershipPhrase, dbOwnership);

  if (shouldLogDebug) {
    console.info("[skillSearchEngine] normalized skills", normalizedSkills);
    console.info("[skillSearchEngine] enriched query", enrichedQuery);
    console.info("[skillSearchEngine] concept resolution", conceptResolution);
    console.info("[skillSearchEngine] canonical skill ids", canonicalSkillIds);
    console.info("[skillSearchEngine] ownership merge", ownershipMerged);
  }

  const { data, error } = await sb.rpc("search_roles_v3", {
    input_text: enrichedQuery,
    selected_department: params.selectedDepartment || null,
    currency: params.currency || "INR",
    limit_count: params.limitCount || 10
  });

  if (error) throw new Error(error.message || "search_roles_v3 failed");
  const rpcResults = Array.isArray(data) ? data : [];
  if (shouldLogDebug) {
    console.info("[skillSearchEngine] rpc candidate count", rpcResults.length);
  }

  let skillGraphDebug = null;
  let mergedPreRank = rpcResults;
  if (canonicalSkillIds.length) {
    const graphPack = await fetchSkillGraphRoleRows(sb, {
      canonicalSkillIds,
      normalizedSkills,
      selectedDepartment: params.selectedDepartment || null,
      limitCount: params.limitCount || 10,
      currency: params.currency || "INR",
      minScore: 0.06
    });
    skillGraphDebug = graphPack.debug;
    mergedPreRank = mergeRpcAndGraphCandidates(rpcResults, graphPack.results);
    if (shouldLogDebug) {
      console.info("[skillSearchEngine] skill graph candidates", graphPack.results.length, "merged", mergedPreRank.length);
    }
  }

  let finalResults = rerankStructuredResults(mergedPreRank, normalizedSkills, {
    normalizedQuery: enrichedQuery,
    dbCanonicalExtras: conceptResolution.resolvedCanonicalLower,
    ownershipCtx: ownershipMerged
  });
  let fallbackDebug = null;
  if (!finalResults.length) {
    const fallback = await fallbackDeterministicSkillSearch(sb, {
      canonicalSkillIds,
      normalizedSkills,
      selectedDepartment: params.selectedDepartment || null,
      limitCount: params.limitCount || 10,
      currency: params.currency || "INR"
    });
    finalResults = rerankStructuredResults(fallback.results, normalizedSkills, {
      normalizedQuery: enrichedQuery,
      dbCanonicalExtras: conceptResolution.resolvedCanonicalLower,
      ownershipCtx: ownershipMerged
    });
    fallbackDebug = fallback.debug;
  }

  const matchedRoleSkillsRows = finalResults.reduce((acc, row) => acc + Number(row?.matched_skill_count || 0), 0);
  if (shouldLogDebug) {
    console.info("[skillSearchEngine] matched role_skills rows", matchedRoleSkillsRows);
    console.info("[skillSearchEngine] final candidate count", finalResults.length);
  }

  const debug = {
    normalizedSkills,
    enrichedQuery,
    resolvedCanonicals: conceptResolution.resolvedCanonicalLower,
    expandedSkillTokens: expandSkillAliases(
      normalizeList([...normalizedSkills, ...conceptResolution.resolvedCanonicalLower])
    ),
    canonicalSkillIds,
    ownershipMerged,
    skillGraphRetrieval: skillGraphDebug,
    mergedPreRankCount: mergedPreRank.length,
    rpcCandidateCount: rpcResults.length,
    matchedRoleSkillsRows,
    finalCandidateCount: finalResults.length,
    fallback: fallbackDebug,
    roleSkillClassification: {
      sampleTopResults: finalResults.slice(0, 5).map((r) => {
        const req = normalizeList(r?.required_skills || []);
        const nice = normalizeList(r?.good_to_have || []);
        const matched = normalizeList(r?.matched_skills || []);
        const input = expandSkillAliases(
          normalizeList([...normalizedSkills, ...conceptResolution.resolvedCanonicalLower])
        );
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
    normalizedQuery: enrichedQuery,
    detectedSkills: normalizedSkills,
    inferredRoleIds: finalResults.map((r) => r?.role_id).filter(Boolean),
    results: finalResults,
    responseTimeMs: Date.now() - startedAt,
    debug
  };
}

