import { getSupabaseAdmin } from "../../supabaseClient.js";

function normalizeTitleQuery(rawQuery) {
  return String(rawQuery || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DESIGNATION_WORDS = new Set([
  "senior","sr","junior","jr","lead","principal","staff","intern","trainee","assistant","associate",
  "manager","head","director","vp","avp","chief","officer"
]);

const TITLE_TOKEN_ALIASES = {
  hr: ["human resources", "people", "talent"],
  talent: ["hr", "recruitment"],
  recruitment: ["talent acquisition", "recruiter"],
  finance: ["accounting", "accounts", "fp&a"],
  engineering: ["developer", "software", "tech"],
  developer: ["engineer", "software"],
  operations: ["operation", "ops"],
  analytics: ["analyst", "data", "bi"],
  data: ["analytics", "bi", "business intelligence"],
  product: ["pm", "product management"],
  marketing: ["growth", "brand", "demand generation"]
};

const DEPT_HINTS = {
  "hr": ["hr","human resources","people","talent","recruitment","recruiter","ta"],
  "finance": ["finance","accounting","accounts","fp&a","treasury","audit"],
  "sales": ["sales","business development","bd","revenue","sdr","bdr","ae"],
  "marketing": ["marketing","growth","brand","content","seo","performance"],
  "engineering": ["engineering","developer","software","frontend","backend","fullstack","sde","swe","tech","it","technology"],
  "product": ["product","pm","apm","gpm","pmm","owner"],
  "operations": ["operations","operation","ops","process"],
  "data": ["data","analytics","analyst","bi","business intelligence","ml","ai"],
  "design": ["design","ux","ui","figma","product design","visual"],
  "customer success": ["customer success","customer","client","support","csm","cx"]
};

function stripDesignationWords(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !DESIGNATION_WORDS.has(w))
    .join(" ");
}

function normalizeTitleSearchText(v) {
  return normalizeTitleQuery(stripDesignationWords(v));
}

function expandTitleTokens(v) {
  const base = normalizeTitleSearchText(v).split(" ").filter(Boolean);
  const out = new Set(base);
  for (const t of base) {
    for (const alias of TITLE_TOKEN_ALIASES[t] || []) {
      for (const p of String(alias).toLowerCase().split(/\s+/)) if (p) out.add(p);
    }
  }
  return [...out];
}

function inferDeptFromQuery(rawQuery) {
  const q = normalizeTitleQuery(rawQuery);
  let best = "";
  let bestScore = 0;
  for (const [dept, hints] of Object.entries(DEPT_HINTS)) {
    const score = hints.filter((h) => q.includes(normalizeTitleQuery(h))).length;
    if (score > bestScore) {
      bestScore = score;
      best = dept;
    }
  }
  return best;
}

function tokenOverlapScore(a, b) {
  const aTokens = new Set(String(a || "").split(" ").filter((t) => t.length >= 2));
  const bTokens = new Set(String(b || "").split(" ").filter((t) => t.length >= 2));
  if (!aTokens.size || !bTokens.size) return 0;
  let hit = 0;
  for (const t of aTokens) if (bTokens.has(t)) hit += 1;
  return hit / Math.max(aTokens.size, 1);
}

export async function titleSearchEngine(params) {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");

  const startedAt = Date.now();
  const normalizedQuery = normalizeTitleQuery(params.rawQuery);
  const normalizedQueryNoDesignation = normalizeTitleSearchText(params.rawQuery);
  const expandedTokens = expandTitleTokens(params.rawQuery);
  const hintedDept = inferDeptFromQuery(params.rawQuery);

  const [rolesRes, aliasRes, roleSkillsRes, skillsRes] = await Promise.all([
    sb.from("roles_v2").select("id, canonical_title, role_family, hint, active").eq("active", true),
    sb.from("role_aliases").select("role_id, alias"),
    sb.from("role_skills").select("role_id, skill_id, importance"),
    sb.from("skills_v2").select("id, canonical_name")
  ]);

  if (rolesRes.error) throw new Error(rolesRes.error.message || "roles_v2 query failed");
  if (aliasRes.error) throw new Error(aliasRes.error.message || "role_aliases query failed");
  if (roleSkillsRes.error) throw new Error(roleSkillsRes.error.message || "role_skills query failed");
  if (skillsRes.error) throw new Error(skillsRes.error.message || "skills_v2 query failed");

  const aliasesByRole = new Map();
  for (const row of aliasRes.data || []) {
    const list = aliasesByRole.get(row.role_id) || [];
    if (row.alias) list.push(String(row.alias));
    aliasesByRole.set(row.role_id, list);
  }

  const skillNameById = new Map((skillsRes.data || []).map((s) => [s.id, String(s.canonical_name || "")]));
  const skillsByRole = new Map();
  for (const rs of roleSkillsRes.data || []) {
    const list = skillsByRole.get(rs.role_id) || { required: [], good_to_have: [] };
    const skillName = skillNameById.get(rs.skill_id);
    if (skillName) {
      if (rs.importance === "required") list.required.push(skillName);
      else if (rs.importance === "good_to_have") list.good_to_have.push(skillName);
    }
    skillsByRole.set(rs.role_id, list);
  }

  const ranked = (rolesRes.data || [])
    .map((role) => {
      const titleNorm = normalizeTitleQuery(role.canonical_title);
      const aliases = aliasesByRole.get(role.id) || [];
      const aliasNormList = aliases.map((a) => normalizeTitleQuery(a));
      const exactTitle = normalizedQuery === titleNorm ? 1 : 0;
      const exactTitleNoDesignation = normalizedQueryNoDesignation === normalizeTitleSearchText(role.canonical_title) ? 1 : 0;
      const exactAlias = aliasNormList.includes(normalizedQuery) ? 1 : 0;
      const titleOverlap = tokenOverlapScore(normalizedQuery, titleNorm);
      const aliasOverlap = aliasNormList.reduce((m, a) => Math.max(m, tokenOverlapScore(normalizedQuery, a)), 0);
      const corpus = `${normalizeTitleSearchText(role.canonical_title)} ${aliasNormList.join(" ")}`;
      const expandedTokenHits = expandedTokens.filter((t) => t.length >= 2 && corpus.includes(t)).length;
      const expandedTokenRatio = expandedTokenHits / Math.max(1, expandedTokens.length);
      const deptBoost = hintedDept && normalizeTitleQuery(role.role_family || "").includes(hintedDept) ? 0.18 : 0;
      const proximity = Math.max(titleOverlap, aliasOverlap);
      const finalScore = Math.min(
        1,
        exactTitle * 0.42 +
        exactTitleNoDesignation * 0.24 +
        exactAlias * 0.22 +
        proximity * 0.08 +
        expandedTokenRatio * 0.04 +
        deptBoost
      );
      return {
        role_id: role.id,
        canonical_title: role.canonical_title,
        department_name: role.role_family || "General",
        level_code: "L2",
        level_display: "Mid",
        final_score: finalScore,
        confidence: finalScore >= 0.75 ? "high" : finalScore >= 0.45 ? "medium" : "low",
        hint: role.hint || "",
        required_skills: (skillsByRole.get(role.id)?.required || []).slice(0, 12),
        good_to_have: (skillsByRole.get(role.id)?.good_to_have || []).slice(0, 12),
        aliases: aliases,
        matched_skills: [],
        missing_skills: [],
        matched_skill_count: 0,
        missing_skill_count: 0,
        why_matched: exactTitle
          ? "Exact canonical title match."
          : exactAlias
            ? "Exact role alias match."
            : "Title proximity match from canonical title and aliases.",
        semantic_terms: normalizedQuery.split(" ").filter(Boolean),
        percentile_25: null,
        percentile_75: null,
        benchmark_currency: (params.currency || "INR").toUpperCase(),
        salary_display: "",
        min_exp: 0,
        max_exp: 0
      };
    })
    .filter((r) => r.final_score >= 0.15)
    .sort((a, b) => b.final_score - a.final_score || a.canonical_title.localeCompare(b.canonical_title))
    .slice(0, Math.min(Math.max(1, params.limitCount || 10), 50));

  return {
    workflowType: "title",
    normalizedQuery,
    detectedSkills: [],
    inferredRoleIds: ranked.map((r) => r.role_id),
    results: ranked,
    responseTimeMs: Date.now() - startedAt
  };
}

