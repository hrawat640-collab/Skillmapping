import express from "express";
import { getSupabaseAdmin } from "../supabaseClient.js";
import { searchOrchestratedLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

const CACHE_TTL_MS = 5 * 60 * 1000;
let _rolesCache = null;
let _rolesCachedAt = 0;

async function getRoleCatalog() {
  if (_rolesCache && Date.now() - _rolesCachedAt < CACHE_TTL_MS) return _rolesCache;
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data } = await sb
    .from("roles")
    .select("title, dept, keywords, required, nice")
    .eq("active", true)
    .order("title")
    .limit(220);
  _rolesCache = data || [];
  _rolesCachedAt = Date.now();
  return _rolesCache;
}

function buildPrompt(query, roles) {
  const catalog = roles
    .map((r) => {
      const kws = [...(r.keywords || []), ...(r.required || []), ...(r.nice || [])]
        .slice(0, 8)
        .join(", ");
      return `- ${r.title} [${r.dept || "General"}] keywords: ${kws}`;
    })
    .join("\n");

  return `You are matching a hiring description to a fixed role database.
Description: "${query}"

Role catalog:
${catalog}

Return STRICT JSON only:
{"roles":["Role A","Role B","Role C"],"skills":["Skill 1","Skill 2","Skill 3"]}
Rules:
- roles must be exact titles from role catalog only
- max 3 roles, max 8 skills
- prefer concrete tools/skills from the description`;
}

router.post("/nl-extract", searchOrchestratedLimiter, async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
  if (!query) return res.status(400).json({ error: "Missing query" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.json({ roles: [], skills: [], skipped: true });
  }

  try {
    const roles = await getRoleCatalog();
    const prompt = buildPrompt(query, roles);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 400 }
        })
      }
    );

    if (!geminiRes.ok) {
      return res.json({ roles: [], skills: [], skipped: true });
    }

    const data = await geminiRes.json();
    const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    const titleSet = new Set(roles.map((r) => String(r.title || "").toLowerCase()));
    const validRoles = (Array.isArray(parsed.roles) ? parsed.roles : [])
      .map((t) => String(t || "").trim())
      .filter((t) => titleSet.has(t.toLowerCase()))
      .slice(0, 3);
    const skills = (Array.isArray(parsed.skills) ? parsed.skills : [])
      .map((s) => String(s || "").trim())
      .filter(Boolean)
      .slice(0, 8);

    res.json({ roles: validRoles, skills });
  } catch (e) {
    console.warn("Gemini nl-extract failed:", e.message || e);
    res.json({ roles: [], skills: [], skipped: true });
  }
});

export default router;
