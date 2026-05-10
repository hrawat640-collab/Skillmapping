import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getSupabaseAdmin } from "../supabaseClient.js";
import { authLoginLimiter, authRegisterLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/register", authRegisterLimiter, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const sb = getSupabaseAdmin();
  if (!sb) {
    return res.status(503).json({
      error: "Auth unavailable: configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)."
    });
  }

  const normalizedEmail = String(email || "").toLowerCase().trim();
  const { data: existsRows, error: existsErr } = await sb
    .from("sm_users")
    .select("id")
    .eq("email", normalizedEmail)
    .limit(1);
  if (existsErr) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "supabase_query_failed",
        request_id: req.requestId || null,
        route: "auth_register_lookup",
        message: existsErr.message || "User lookup failed"
      })
    );
    return res.status(500).json({ error: existsErr.message || "User lookup failed" });
  }
  if (Array.isArray(existsRows) && existsRows.length) {
    return res.status(409).json({ error: "User already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { data: inserted, error: insertErr } = await sb
    .from("sm_users")
    .insert({ name: String(name || "").trim(), email: normalizedEmail, password_hash: passwordHash })
    .select("id, name, email")
    .single();
  if (insertErr) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "supabase_query_failed",
        request_id: req.requestId || null,
        route: "auth_register_insert",
        message: insertErr.message || "User create failed"
      })
    );
    return res.status(500).json({ error: insertErr.message || "User create failed" });
  }

  const token = jwt.sign({ sub: inserted.id, email: inserted.email }, process.env.JWT_SECRET, {
    expiresIn: "7d"
  });
  res.json({ token, user: { id: inserted.id, name: inserted.name, email: inserted.email } });
});

router.post("/login", authLoginLimiter, async (req, res) => {
  const { email, password } = req.body;
  const sb = getSupabaseAdmin();
  if (!sb) {
    return res.status(503).json({
      error: "Auth unavailable: configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)."
    });
  }
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const { data: user, error: userErr } = await sb
    .from("sm_users")
    .select("id, name, email, password_hash")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (userErr) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "supabase_query_failed",
        request_id: req.requestId || null,
        route: "auth_login_lookup",
        message: userErr.message || "User lookup failed"
      })
    );
    return res.status(500).json({ error: userErr.message || "User lookup failed" });
  }
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password || "", user.password_hash || "");
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "7d"
  });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

export default router;
