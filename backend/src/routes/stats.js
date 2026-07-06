import express from "express";
import { getSupabaseAdmin } from "../supabaseClient.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

const statsLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 60,
  keyGenerator: (req) => `${req.ip || "unknown"}:stats`
});

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedHighlights = null;
let cacheExpiresAt = 0;
let cacheTimer = null;

const RECENT_CACHE_TTL_MS = 60 * 1000;
let cachedRecentActivity = null;
let recentCacheExpiresAt = 0;
let recentCacheTimer = null;

async function countTable(sb, table) {
  const { count, error } = await sb
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) throw error;
  return Number(count || 0);
}

async function countDistinctCities(sb) {
  const cities = new Set();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await sb
      .from("sm_salary_contribution")
      .select("loc_detected")
      .not("loc_detected", "is", null)
      .neq("loc_detected", "")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      const loc = String(row.loc_detected || "").trim();
      if (loc) cities.add(loc);
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return cities.size;
}

async function computeHighlights() {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const err = new Error("Database unavailable");
    err.status = 503;
    throw err;
  }

  let roleCount = await countTable(sb, "roles_v2");
  if (!roleCount) {
    roleCount = await countTable(sb, "roles");
  }

  let skillCount = await countTable(sb, "skills_v2");
  if (!skillCount) {
    skillCount = await countTable(sb, "skills");
  }

  const contributionCount = await countTable(sb, "sm_salary_contribution");
  const cityCount = await countDistinctCities(sb);

  return {
    role_count: roleCount,
    skill_count: skillCount,
    contribution_count: contributionCount,
    city_count: cityCount
  };
}

function getCachedHighlights() {
  if (cachedHighlights && Date.now() < cacheExpiresAt) {
    return cachedHighlights;
  }
  return null;
}

function setCachedHighlights(data) {
  cachedHighlights = data;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;

  if (cacheTimer) clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => {
    cachedHighlights = null;
    cacheExpiresAt = 0;
    cacheTimer = null;
  }, CACHE_TTL_MS);
}

function getCachedRecentActivity() {
  if (cachedRecentActivity && Date.now() < recentCacheExpiresAt) {
    return cachedRecentActivity;
  }
  return null;
}

function setCachedRecentActivity(data) {
  cachedRecentActivity = data;
  recentCacheExpiresAt = Date.now() + RECENT_CACHE_TTL_MS;

  if (recentCacheTimer) clearTimeout(recentCacheTimer);
  recentCacheTimer = setTimeout(() => {
    cachedRecentActivity = null;
    recentCacheExpiresAt = 0;
    recentCacheTimer = null;
  }, RECENT_CACHE_TTL_MS);
}

async function fetchRecentActivity() {
  const sb = getSupabaseAdmin();
  if (!sb) {
    const err = new Error("Database unavailable");
    err.status = 503;
    throw err;
  }

  const { data, error } = await sb
    .from("sm_salary_contribution")
    .select("designation, loc_detected, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;

  return {
    recent: (data || []).map((row) => ({
      designation: row.designation ?? null,
      loc_detected: row.loc_detected ?? null,
      created_at: row.created_at ?? null
    }))
  };
}

// GET /api/stats/highlights
router.get("/stats/highlights", statsLimiter, async (_req, res) => {
  try {
    const cached = getCachedHighlights();
    if (cached) {
      return res.json(cached);
    }

    const highlights = await computeHighlights();
    setCachedHighlights(highlights);
    return res.json(highlights);
  } catch (e) {
    const status = e?.status || 500;
    return res.status(status).json({ error: e?.message || "Failed to load stats" });
  }
});

// GET /api/stats/recent-activity
router.get("/stats/recent-activity", statsLimiter, async (_req, res) => {
  try {
    const cached = getCachedRecentActivity();
    if (cached) {
      return res.json(cached);
    }

    const recent = await fetchRecentActivity();
    setCachedRecentActivity(recent);
    return res.json(recent);
  } catch (e) {
    const status = e?.status || 500;
    return res.status(status).json({ error: e?.message || "Failed to load recent activity" });
  }
});

export default router;
