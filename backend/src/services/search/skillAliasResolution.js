/**
 * Connects skills_v2 + skill_aliases into query normalization (source of truth in DB).
 * Resolves recruiter shorthand, abbreviations, and multi-word aliases before retrieval/ranking.
 */

function normalizeSkillText(t) {
  return String(t || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSkillAliasIndexes(canonicalRows, aliasRows) {
  const canonicalByLower = new Map();
  const idToCanonicalLower = new Map();
  for (const r of canonicalRows || []) {
    const id = r.id;
    const low = String(r.canonical_name || "").toLowerCase().trim();
    if (!low || !id) continue;
    canonicalByLower.set(low, id);
    idToCanonicalLower.set(id, low);
  }
  const aliasToSkillId = new Map();
  for (const r of aliasRows || []) {
    const a = String(r.alias || "").toLowerCase().trim();
    if (a) aliasToSkillId.set(a, r.skill_id);
  }
  return { canonicalByLower, idToCanonicalLower, aliasToSkillId };
}

/**
 * Scan free text + explicit skill chips for canonical names and alias phrases (including n-grams).
 */
export function resolveProfessionalConcepts(textSources, idx) {
  const resolvedSkillIds = new Set();
  const resolvedCanonicalLower = new Set();

  const ingestPhrase = (phrase) => {
    const p = normalizeSkillText(phrase);
    if (!p) return;
    if (idx.canonicalByLower.has(p)) {
      const id = idx.canonicalByLower.get(p);
      resolvedSkillIds.add(id);
      const cn = idx.idToCanonicalLower.get(id);
      if (cn) resolvedCanonicalLower.add(cn);
      return;
    }
    if (idx.aliasToSkillId.has(p)) {
      const id = idx.aliasToSkillId.get(p);
      resolvedSkillIds.add(id);
      const cn = idx.idToCanonicalLower.get(id);
      if (cn) resolvedCanonicalLower.add(cn);
    }
  };

  const sources = (Array.isArray(textSources) ? textSources : [textSources]).filter(Boolean);
  for (const src of sources) {
    const norm = normalizeSkillText(src);
    if (!norm) continue;
    ingestPhrase(norm);
    const words = norm.split(" ").filter((w) => w.length > 0);
    const maxN = Math.min(12, words.length);
    for (let n = maxN; n >= 1; n--) {
      for (let i = 0; i + n <= words.length; i++) {
        ingestPhrase(words.slice(i, i + n).join(" "));
      }
    }
  }

  return {
    resolvedSkillIds: [...resolvedSkillIds],
    resolvedCanonicalLower: [...resolvedCanonicalLower].filter(Boolean)
  };
}

/**
 * Dominant role_family values for resolved skills via role_skills → roles_v2 (weighted by importance).
 */
export async function fetchOwnershipFamiliesFromSkillIds(sb, skillIds) {
  const ids = [...new Set((skillIds || []).filter(Boolean))];
  if (!ids.length || !sb) return null;

  const { data: rs, error } = await sb.from("role_skills").select("role_id, importance").in("skill_id", ids);
  if (error || !rs?.length) return null;

  const roleIds = [...new Set(rs.map((r) => r.role_id))];
  const { data: roles, error: rerr } = await sb
    .from("roles_v2")
    .select("id, role_family")
    .in("id", roleIds)
    .eq("active", true);
  if (rerr || !roles?.length) return null;

  const famByRole = new Map(roles.map((r) => [r.id, String(r.role_family || "General").toLowerCase()]));

  const weights = new Map();
  for (const row of rs) {
    const fam = famByRole.get(row.role_id);
    if (!fam) continue;
    const w =
      row.importance === "required" ? 3 : row.importance === "good_to_have" ? 1.5 : 1;
    weights.set(fam, (weights.get(fam) || 0) + w);
  }
  if (!weights.size) return null;

  const sorted = [...weights.entries()].sort((a, b) => b[1] - a[1]);
  const ownerFamilies = new Set(sorted.slice(0, 6).map(([f]) => f));
  const top = sorted[0][1];
  const second = sorted[1]?.[1] || 0;
  const separation = second > 0 ? top / (top + second) : 1;
  const strength = Math.min(1, 0.48 + 0.28 * separation + 0.12 * Math.min(3, sorted.length));

  return {
    ownerFamilies,
    strength,
    source: "role_skills",
    matchedRules: [],
    ruleIds: ["db_skill_family_prior"],
    _dbFamilyWeights: sorted.slice(0, 6)
  };
}
