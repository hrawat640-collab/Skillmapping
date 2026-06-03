import express from "express";
import { getSupabaseAdmin } from "../supabaseClient.js";

const router = express.Router();

const CACHE_TTL_MS = 5 * 60 * 1000;
const _cache = { roles: null, skills: null, departments: null };
const _loadedAt = { roles: 0, skills: 0, departments: 0 };

function isFresh(key) {
  return _cache[key] !== null && Date.now() - _loadedAt[key] < CACHE_TTL_MS;
}

function salPipe(inrRaw, usdRaw) {
  let inr = String(inrRaw || "").trim();
  let usd = String(usdRaw || "").trim();
  if (inr && inr[0] !== "₹" && inr[0] !== "$" && /\d/.test(inr)) inr = "₹" + inr.replace(/^₹+/, "");
  if (usd && usd[0] !== "$" && /\d/.test(usd)) usd = "$" + usd.replace(/^\$/, "");
  return (inr || "") + "|" + (usd || "");
}

function normaliseRole(r) {
  function expArr(e) {
    return e ? [e.min, e.max, salPipe(e.inr, e.usd)] : [null, null, null];
  }
  return {
    id: r.id != null ? String(r.id) : null,
    title: r.title,
    dept: r.dept,
    role_summary: String(r.role_summary || "").trim(),
    short_description: String(r.short_description || "").trim(),
    semantic_summary: String(r.semantic_summary || r.semantic_metadata_summary || "").trim(),
    desc: String(r.description || r.desc || "").trim(),
    hint: r.hint || "",
    cvTip: r.cv_tip || "",
    nl_patterns: r.nl_patterns || [],
    keywords: r.keywords || [],
    required: r.required || [],
    nice: r.nice || [],
    exp: {
      junior: expArr(r.exp_junior),
      mid: expArr(r.exp_mid),
      senior: expArr(r.exp_senior),
      lead: expArr(r.exp_lead)
    }
  };
}

router.get("/roles", async (req, res) => {
  if (isFresh("roles")) return res.json({ roles: _cache.roles });
  const sb = getSupabaseAdmin();
  if (!sb) return res.status(503).json({ error: "Database unavailable" });

  // Fetch roles + aliases in parallel
  const [rolesRes, aliasRes] = await Promise.all([
    sb.from("roles").select("*").eq("active", true).order("title"),
    sb.from("role_aliases").select("role_id, alias")
  ]);
  if (rolesRes.error) return res.status(500).json({ error: rolesRes.error.message });

  // Build alias lookup: role_id → string[]
  const aliasesByRoleId = new Map();
  for (const row of aliasRes.data || []) {
    const list = aliasesByRoleId.get(row.role_id) || [];
    list.push(row.alias);
    aliasesByRoleId.set(row.role_id, list);
  }

  _cache.roles = (rolesRes.data || []).map((r) => ({
    ...normaliseRole(r),
    aliases: aliasesByRoleId.get(r.id) || []
  }));
  _loadedAt.roles = Date.now();
  res.json({ roles: _cache.roles });
});

router.get("/skills", async (req, res) => {
  if (isFresh("skills")) return res.json({ skills: _cache.skills });
  const sb = getSupabaseAdmin();
  if (!sb) return res.status(503).json({ error: "Database unavailable" });
  const { data, error } = await sb
    .from("skills")
    .select("id, name, category, implies, aliases")
    .eq("active", true)
    .order("name");
  if (error) return res.status(500).json({ error: error.message });
  _cache.skills = data || [];
  _loadedAt.skills = Date.now();
  res.json({ skills: _cache.skills });
});

router.get("/departments", async (req, res) => {
  if (isFresh("departments")) return res.json({ departments: _cache.departments });
  const sb = getSupabaseAdmin();
  if (!sb) return res.status(503).json({ error: "Database unavailable" });
  const { data, error } = await sb
    .from("departments")
    .select("id, name, bg_color, text_color, sort_order")
    .order("sort_order");
  if (error) return res.status(500).json({ error: error.message });
  _cache.departments = data || [];
  _loadedAt.departments = Date.now();
  res.json({ departments: _cache.departments });
});

export default router;
