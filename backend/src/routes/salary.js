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

const LAST_CONTRIBUTION_COLUMNS =
  "designation, dept, sub_dept, company, country, currency, experience_range, ctc";

function pickLastContribution(row) {
  return {
    designation: row?.designation ?? null,
    dept: row?.dept ?? null,
    sub_dept: row?.sub_dept ?? null,
    company: row?.company ?? null,
    country: row?.country ?? null,
    currency: row?.currency ?? null,
    experience_range: row?.experience_range ?? null,
    ctc: row?.ctc ?? null
  };
}

async function fetchLastContributionRow(sb, email, userUuid) {
  if (userUuid) {
    const { data } = await sb
      .from("sm_salary_contribution")
      .select(LAST_CONTRIBUTION_COLUMNS)
      .eq("user_uuid", userUuid)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data?.[0]) return data[0];
  }
  if (email) {
    const { data } = await sb
      .from("sm_salary_contribution")
      .select(LAST_CONTRIBUTION_COLUMNS)
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data?.[0]) return data[0];
  }
  return null;
}

// GET /api/salary/is-unlocked
router.get("/salary/is-unlocked", salaryLimiter, async (req, res) => {
  const email = typeof req.query.email === "string" ? req.query.email.trim() : "";
  const userUuid = typeof req.query.user_uuid === "string" ? req.query.user_uuid.trim() : "";

  if (!email && !userUuid) {
    return res.json({ unlocked: false, reason: "no_identity" });
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return res.json({ unlocked: false, reason: "error", message: "Database unavailable" });
  }

  try {
    const { data: hasContribution, error: rpcError } = await sb.rpc("sm_has_salary_contribution", {
      p_email: email || null,
      p_user_uuid: userUuid || null
    });

    if (rpcError) {
      return res.json({ unlocked: false, reason: "error", message: rpcError.message });
    }

    if (hasContribution !== true) {
      return res.json({ unlocked: false, reason: "annual_reset_or_never_contributed" });
    }

    const row = await fetchLastContributionRow(sb, email, userUuid);
    return res.json({
      unlocked: true,
      lastContribution: pickLastContribution(row)
    });
  } catch (e) {
    return res.json({
      unlocked: false,
      reason: "error",
      message: e?.message || String(e)
    });
  }
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

  const { dept, sub_dept, your_role, years_working, compensation, currency, country, company, company_stage } = req.body;
  if (!compensation || !compensation.toString().trim()) {
    return res.status(400).json({ error: "compensation is required" });
  }

  const sb = getSupabaseAdmin();
  if (!sb) return res.status(503).json({ error: "Database unavailable" });

  // Resolve user email from token if available
  let userEmail = null;
  if (!userId && token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded?.email) {
        userEmail = decoded.email;
        const { data } = await sb.from("sm_users").select("id").eq("email", decoded.email).maybeSingle();
        userId = data?.id || null;
      }
    } catch { /* noop */ }
  }

  const payload = {
    designation: your_role ? String(your_role).trim() : null,
    dept: dept ? String(dept).trim() : null,
    sub_dept: sub_dept ? String(sub_dept).trim() : null,
    experience_range: years_working ? String(years_working).trim() : null,
    ctc: String(compensation).trim(),
    currency: currency ? String(currency).trim() : "INR",
    country: country ? String(country).trim() : null,
    company: company ? String(company).trim() : null,
    role_desc: company_stage ? String(company_stage).trim() : null,
    user_id: userId,
    email: userEmail || "anonymous@skillmapper.app"
  };

  const { error } = await sb.from("sm_salary_contribution").insert(payload);
  if (error) {
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
