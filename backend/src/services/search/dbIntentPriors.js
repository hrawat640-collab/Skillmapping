/**
 * D: DB-driven intent priors
 * Loads nl_patterns from the roles table and provides per-role query scoring,
 * replacing / augmenting the hardcoded INTENT_PRIORS regex map.
 */

import { getSupabaseAdmin } from "../../supabaseClient.js";

const CACHE_TTL_MS = 5 * 60 * 1000;
let _cache = null;
let _loadedAt = 0;

/**
 * Returns the role NL-pattern catalog from Supabase (5-min in-process cache).
 * Each entry: { id, title, dept, nl_patterns: string[] }
 */
export async function getNlPatternCatalog() {
  if (_cache && Date.now() - _loadedAt < CACHE_TTL_MS) return _cache;
  const sb = getSupabaseAdmin();
  if (!sb) return _cache || [];

  const { data, error } = await sb
    .from("roles")
    .select("id, title, dept, nl_patterns")
    .eq("active", true);

  if (error) {
    console.warn("[dbIntentPriors] catalog load failed:", error.message || error);
    return _cache || [];
  }

  _cache = (data || []).filter(
    (r) => Array.isArray(r.nl_patterns) && r.nl_patterns.length > 0
  );
  _loadedAt = Date.now();
  return _cache;
}

/**
 * Returns a 0–1 score for how well `normalizedQuery` matches a role's nl_patterns.
 * Uses token-overlap ratio across all patterns; returns the best match.
 */
export function scoreNlPatternMatch(normalizedQuery, nlPatterns) {
  if (!nlPatterns?.length || !normalizedQuery) return 0;
  const q = normalizedQuery.toLowerCase();
  let best = 0;
  for (const raw of nlPatterns) {
    const p = String(raw || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .trim();
    if (!p) continue;
    const tokens = p.split(/\s+/).filter((t) => t.length >= 2);
    if (!tokens.length) continue;
    const matched = tokens.filter((t) => q.includes(t)).length;
    const ratio = matched / tokens.length;
    if (ratio > best) best = ratio;
  }
  return best;
}

/**
 * Given a set of search-result rows (each with `canonical_title`), applies a
 * DB-pattern boost by matching the query against each role's nl_patterns.
 * Returns re-sorted rows.  Max boost = +0.14 (capped at score 1.0).
 */
export function applyDbPatternBoosts(rows, normalizedQuery, nlCatalog) {
  if (!rows?.length || !normalizedQuery || !nlCatalog?.length) return rows;

  const byTitle = new Map(
    nlCatalog.map((r) => [String(r.title || "").toLowerCase(), r.nl_patterns || []])
  );

  const boosted = rows.map((row) => {
    const title = String(row?.canonical_title || "").toLowerCase();
    const patterns = byTitle.get(title) || [];
    const patternScore = scoreNlPatternMatch(normalizedQuery, patterns);
    if (patternScore < 0.3) return row;
    const boost = Math.min(0.14, patternScore * 0.14);
    return {
      ...row,
      final_score: Math.min(1, Number(row.final_score || 0) + boost),
      _db_pattern_boost: boost
    };
  });

  return boosted.sort(
    (a, b) =>
      Number(b.final_score || 0) - Number(a.final_score || 0) ||
      String(a.canonical_title || "").localeCompare(String(b.canonical_title || ""))
  );
}
