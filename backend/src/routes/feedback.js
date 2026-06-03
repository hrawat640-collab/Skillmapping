import express from "express";
import { getSupabaseAdmin } from "../supabaseClient.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

const feedbackLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_FEEDBACK_PER_MIN || 10),
  keyGenerator: (req) => `${req.ip || "unknown"}:feedback`
});

// POST /api/feedback
router.post("/feedback", feedbackLimiter, async (req, res) => {
  const { message, type, page } = req.body;
  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  const sb = getSupabaseAdmin();
  if (!sb) return res.status(503).json({ error: "Database unavailable" });

  const payload = {
    message: String(message).trim().slice(0, 2000),
    type: type ? String(type).trim() : "general",
    page: page ? String(page).trim() : null
  };

  let { error } = await sb.from("feedback").insert(payload);

  if (error?.message?.includes("column")) {
    // Schema mismatch — try minimal insert
    const { error: e2 } = await sb.from("feedback").insert({ message: payload.message });
    if (e2) return res.status(500).json({ error: e2.message });
    return res.json({ ok: true });
  }

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
