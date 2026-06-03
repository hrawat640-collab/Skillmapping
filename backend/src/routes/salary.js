import express from "express";
import jwt from "jsonwebtoken";
import { getSupabaseAdmin } from "../supabaseClient.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

const salaryLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_SALARY_PER_MIN || 10),
  keyGenerator: (req) => `${req.ip || "unknown"}:salary`
});

// POST /api/salary/contribute
router.post("/salary/contribute", salaryLimiter, async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  let userId = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.sub || null;
    } catch {
      // anonymous contribution is allowed
    }
  }

  const { role_id, level, inr, usd, yoe, country, city } = req.body;
  if (!role_id || !level) {
    return res.status(400).json({ error: "role_id and level are required" });
  }

  const sb = getSupabaseAdmin();
  if (!sb) return res.status(503).json({ error: "Database unavailable" });

  // If JWT decode worked but sub was email-based, look up the numeric user id
  if (!userId && token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded?.email) {
        const { data } = await sb.from("sm_users").select("id").eq("email", decoded.email).maybeSingle();
        userId = data?.id || null;
      }
    } catch { /* noop */ }
  }

  const payload = {
    role_id: String(role_id),
    level: String(level),
    inr: inr != null ? Number(inr) || null : null,
    usd: usd != null ? Number(usd) || null : null,
    yoe: yoe != null ? Number(yoe) || null : null,
    country: country ? String(country).trim() : null,
    city: city ? String(city).trim() : null,
    user_id: userId
  };

  const { error } = await sb.from("sm_salary_contribution").insert(payload);
  if (error) {
    // FK violation on user_id — retry without it
    if (error.message?.includes("foreign key") || error.message?.includes("violates")) {
      const { error: e2 } = await sb.from("sm_salary_contribution").insert({ ...payload, user_id: null });
      if (e2) return res.status(500).json({ error: e2.message });
      return res.json({ ok: true });
    }
    return res.status(500).json({ error: error.message });
  }
  res.json({ ok: true });
});

export default router;
