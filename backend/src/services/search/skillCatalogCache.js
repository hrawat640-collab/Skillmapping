/**
 * Module-level cache for skills_v2 and skill_aliases.
 * These tables are reference data that rarely change — loading them on every
 * search is wasteful. We cache for 5 minutes; a deploy naturally invalidates it.
 */

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedSkills = null;
let cachedAliases = null;
let lastLoadedAt = 0;

export async function getSkillCatalog(sb) {
  const now = Date.now();
  if (cachedSkills && cachedAliases && now - lastLoadedAt < CACHE_TTL_MS) {
    return { skills: cachedSkills, aliases: cachedAliases, fromCache: true };
  }

  const [{ data: skills, error: skillsErr }, { data: aliases, error: aliasesErr }] = await Promise.all([
    sb.from("skills_v2").select("id, canonical_name"),
    sb.from("skill_aliases").select("skill_id, alias")
  ]);

  if (skillsErr) throw new Error(skillsErr.message || "skills_v2 lookup failed");
  if (aliasesErr) throw new Error(aliasesErr.message || "skill_aliases lookup failed");

  cachedSkills = skills || [];
  cachedAliases = aliases || [];
  lastLoadedAt = now;

  return { skills: cachedSkills, aliases: cachedAliases, fromCache: false };
}

export function invalidateSkillCatalogCache() {
  cachedSkills = null;
  cachedAliases = null;
  lastLoadedAt = 0;
}
