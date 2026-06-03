import express from "express";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

const geminiLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_GEMINI_PER_MIN || 30),
  keyGenerator: (req) => `${req.ip || "unknown"}:gemini`
});

const GEMINI_API_KEY = () => process.env.GEMINI_API_KEY;
const EMBED_MODEL = "text-embedding-004";
const TEXT_MODEL = "gemini-1.5-flash";

async function getEmbedding(text) {
  const key = GEMINI_API_KEY();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${key}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] }
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Gemini embed HTTP ${r.status}`);
  return data.embedding?.values || [];
}

async function extractIntent(text) {
  const key = GEMINI_API_KEY();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${key}`;
  const prompt = [
    "Extract the core technical skills and role type from this hiring description.",
    "Return a concise search query under 10 words.",
    `Input: "${text.slice(0, 500)}"`
  ].join(" ");
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Gemini generate HTTP ${r.status}`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
}

// POST /api/gemini/embed
router.post("/gemini/embed", geminiLimiter, async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string") return res.status(400).json({ error: "text is required" });
  if (!GEMINI_API_KEY()) return res.status(503).json({ error: "Gemini API not configured" });
  try {
    const embedding = await getEmbedding(text.slice(0, 2000));
    res.json({ embedding });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/gemini/nl-extract
router.post("/gemini/nl-extract", geminiLimiter, async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string") return res.status(400).json({ error: "text is required" });
  if (!GEMINI_API_KEY()) return res.status(503).json({ error: "Gemini API not configured" });
  try {
    const query = await extractIntent(text);
    res.json({ query });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
