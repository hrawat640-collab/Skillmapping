import express from "express";
import jwt from "jsonwebtoken";
import { getSupabaseAdmin } from "../supabaseClient.js";
import { authLoginLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

function getUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

router.post("/contribute", authLoginLimiter, async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const {
    designation, dept, sub_dept, experience_range,
    ctc, currency, country, company, role_desc, notify_salary
  } = req.body;

  if (!ctc || !company) {
    return res.status(400).json({ error: "Compensation and company are required" });
  }

  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Look up the user's DB id so we can satisfy any user_id FK
  const { data: smUser } = await sb
    .from("sm_users")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();

  const row = {
    email: user.email,
    designation: designation || null,
    dept: dept || null,
    sub_dept: sub_dept || null,
    experience_range: experience_range || null,
    ctc: String(ctc).trim(),
    currency: currency || "INR",
    country: country || null,
    company: String(company).trim(),
    role_desc: role_desc || null,
    notify_salary: notify_salary || "no",
    created_at: now
  };

  // First attempt: with user_id if we have it
  const rowWithUserId = smUser?.id ? { ...row, user_id: smUser.id } : row;
  const { error: e1 } = await sb.from("sm_salary_contribution").insert(rowWithUserId);

  if (!e1) {
    // Success — also update sm_users with salary metadata
    await sb
      .from("sm_users")
      .update({ salary_submitted_at: now, notify_salary: notify_salary || "no" })
      .eq("email", user.email);
    return res.json({ ok: true });
  }

  // Fallback: user_id column might not exist — retry without it
  if (/user_id|user_uuid|column/i.test(e1.message || "")) {
    const { error: e2 } = await sb.from("sm_salary_contribution").insert(row);
    if (!e2) {
      await sb
        .from("sm_users")
        .update({ salary_submitted_at: now, notify_salary: notify_salary || "no" })
        .eq("email", user.email);
      return res.json({ ok: true });
    }
    console.error("salary insert fallback failed:", e2.message);
    return res.status(500).json({ error: "Could not save contribution" });
  }

  console.error("salary insert failed:", e1.message);
  return res.status(500).json({ error: "Could not save contribution" });
});

export default router;
