/**
 * Skill-first candidate generation: traverse role_skills for resolved canonical skill IDs
 * before relying on token overlap (RPC or title heuristics).
 */

function mapConfidence(score) {
  if (score >= 0.7) return "high";
  if (score >= 0.45) return "medium";
  return "low";
}

/**
 * Deterministic rows for roles that map to the given skill IDs via role_skills.
 * Same shape as search_roles_v3 / fallbackDeterministicSkillSearch.
 */
export async function fetchSkillGraphRoleRows(sb, {
  canonicalSkillIds,
  normalizedSkills = [],
  selectedDepartment = null,
  limitCount = 10,
  currency = "INR",
  minScore = 0.08
}) {
  const ids = [...new Set((canonicalSkillIds || []).filter(Boolean))];
  if (!ids.length || !sb) {
    return { results: [], debug: { reason: "no_canonical_skill_ids" } };
  }

  const cap = Math.min(50, Math.max(Number(limitCount) || 10, 1) * 4);

  const [{ data: roleSkillsRows, error: roleSkillsErr }, { data: skillsRows, error: skillsErr }, { data: rolesRows, error: rolesErr }, { data: aliasesRows, error: aliasesErr }, { data: levelsRows, error: levelsErr }] =
    await Promise.all([
      sb.from("role_skills").select("role_id, skill_id, importance, weight"),
      sb.from("skills_v2").select("id, canonical_name"),
      sb.from("roles_v2").select("id, canonical_title, role_family, hint, active").eq("active", true),
      sb.from("role_aliases").select("role_id, alias"),
      sb.from("role_levels_valid").select("role_id, level_code, min_exp, max_exp")
    ]);

  if (roleSkillsErr) throw new Error(roleSkillsErr.message || "role_skills graph query failed");
  if (skillsErr) throw new Error(skillsErr.message || "skills_v2 graph query failed");
  if (rolesErr) throw new Error(rolesErr.message || "roles_v2 graph query failed");
  if (aliasesErr) throw new Error(aliasesErr.message || "role_aliases graph query failed");
  if (levelsErr) throw new Error(levelsErr.message || "role_levels_valid graph query failed");

  const skillNameById = new Map((skillsRows || []).map((s) => [s.id, String(s.canonical_name || "").toLowerCase()]));
  const matchedSkillSet = new Set(ids);
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
      const coverage = normalizedSkills.length > 0 ? matchedRows.length / normalizedSkills.length : 1;
      const score = Math.min(1, weightedOverlap * 0.75 + Math.min(1, coverage) * 0.25);
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
        why_matched: `Skill graph: role_skills match for resolved concept(s). req_hit=${reqHit}, gth_hit=${gthHit}, matched_weight=${matchedWeight.toFixed(2)}`,
        semantic_terms: Array.isArray(normalizedSkills) ? normalizedSkills : [],
        percentile_25: null,
        percentile_75: null,
        benchmark_currency: (currency || "INR").toUpperCase(),
        salary_display: "",
        min_exp: level?.min_exp ?? null,
        max_exp: level?.max_exp ?? null,
        _candidate_source: "skill_graph"
      };
    })
    .filter(Boolean)
    .filter((r) => r.final_score >= minScore)
    .sort((a, b) => b.final_score - a.final_score || a.canonical_title.localeCompare(b.canonical_title))
    .slice(0, cap);

  return {
    results: rows,
    debug: {
      canonicalSkillIdsCount: ids.length,
      candidateRoles: rows.length,
      poolCap: cap
    }
  };
}

function mergeArrays(a, b) {
  return [...new Set([...(a || []), ...(b || [])].map((x) => String(x || "").toLowerCase()).filter(Boolean))];
}

/**
 * Union RPC (token/overlap) candidates with skill-graph rows. On duplicate role_id,
 * merge matched skill fields and keep a stable superset for downstream rerank.
 */
export function mergeRpcAndGraphCandidates(rpcRows, graphRows) {
  const byId = new Map();

  const ingest = (row, source) => {
    const id = row?.role_id;
    if (!id) return;
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, { ...row, _candidate_sources: [source] });
      return;
    }
    const score = Math.max(Number(prev.final_score || 0), Number(row.final_score || 0));
    const sources = [...new Set([...(prev._candidate_sources || []), source])];
    byId.set(id, {
      ...prev,
      ...row,
      final_score: score,
      required_skills: mergeArrays(prev.required_skills, row.required_skills),
      good_to_have: mergeArrays(prev.good_to_have, row.good_to_have),
      matched_skills: mergeArrays(prev.matched_skills, row.matched_skills),
      missing_skills: mergeArrays(prev.missing_skills, row.missing_skills),
      matched_skill_count: Math.max(Number(prev.matched_skill_count || 0), Number(row.matched_skill_count || 0)),
      aliases: Array.isArray(row.aliases) && row.aliases.length ? row.aliases : prev.aliases,
      why_matched:
        prev.why_matched && row.why_matched && prev.why_matched !== row.why_matched
          ? `${prev.why_matched} | ${row.why_matched}`
          : row.why_matched || prev.why_matched,
      _candidate_sources: sources
    });
  };

  for (const r of graphRows || []) ingest(r, "skill_graph");
  for (const r of rpcRows || []) ingest(r, "rpc");

  return [...byId.values()];
}
