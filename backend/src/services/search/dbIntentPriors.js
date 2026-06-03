import { getSupabaseAdmin } from "../../supabaseClient.js";

let _cache = null;
let _loadedAt = 0;
const TTL_MS = 5 * 60 * 1000;

async function loadPriors() {
  if (_cache && Date.now() - _loadedAt < TTL_MS) return _cache;

  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data, error } = await sb
    .from("roles")
    .select("id, nl_patterns")
    .eq("active", true);

  if (error) {
    console.warn("dbIntentPriors: failed to load nl_patterns", error.message);
    return _cache || [];
  }

  _cache = (data || [])
    .filter((r) => Array.isArray(r.nl_patterns) && r.nl_patterns.length)
    .map((r) => ({
      role_id: String(r.id),
      patterns: r.nl_patterns.map((p) => String(p).toLowerCase().trim()).filter(Boolean)
    }));
  _loadedAt = Date.now();
  return _cache;
}

/**
 * Boost scores for results whose role_id matches nl_patterns against the query.
 * Returns a new array — does not mutate input.
 */
export async function applyDbIntentPriorBoosts(results, normalizedQuery) {
  if (!results?.length || !normalizedQuery) return results;

  let priors;
  try {
    priors = await loadPriors();
  } catch {
    return results;
  }
  if (!priors.length) return results;

  const q = normalizedQuery.toLowerCase();
  const priorMap = new Map(priors.map((p) => [p.role_id, p.patterns]));

  return results.map((r) => {
    const rolePatterns = priorMap.get(String(r?.role_id || "")) || [];
    if (!rolePatterns.length) return r;
    const hitCount = rolePatterns.filter((p) => q.includes(p)).length;
    if (!hitCount) return r;
    const boost = Math.min(0.18, hitCount * 0.06);
    const base = Number(r?.final_score || r?.score || 0);
    return {
      ...r,
      final_score: Math.min(1, base + boost)
    };
  });
}
