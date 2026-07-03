import express from "express";
import { getSupabaseAdmin } from "../supabaseClient.js";
import { supabaseAuth } from "../middleware/supabaseAuth.js";
import { authLoginLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

const PROFILE_SELECT = "id, email, name, profession, country, user_uuid, auth_user_id";

function needsProfile(row) {
  const name = String(row?.name || "").trim();
  const profession = String(row?.profession || "").trim();
  const country = String(row?.country || "").trim();
  return !name || !profession || !country;
}

function toPublicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    profession: row.profession ?? null,
    country: row.country ?? null,
    user_uuid: row.user_uuid ?? null
  };
}

async function loadOrCreateSmUser(authUser) {
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "Database unavailable", status: 503 };

  const authUserId = authUser.id;
  const email = String(authUser.email || "").trim();

  const { data: byAuthId, error: byAuthErr } = await sb
    .from("sm_users")
    .select(PROFILE_SELECT)
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (byAuthErr) {
    return { error: byAuthErr.message, status: 500 };
  }
  if (byAuthId) {
    return { row: byAuthId };
  }

  const { data: byEmailRows, error: byEmailErr } = await sb
    .from("sm_users")
    .select(PROFILE_SELECT)
    .ilike("email", email)
    .limit(1);

  if (byEmailErr) {
    return { error: byEmailErr.message, status: 500 };
  }

  const byEmail = byEmailRows?.[0] || null;
  if (byEmail) {
    const patch = {
      auth_user_id: authUserId,
      user_uuid: byEmail.user_uuid || authUserId
    };
    const { data: linked, error: linkErr } = await sb
      .from("sm_users")
      .update(patch)
      .eq("id", byEmail.id)
      .select(PROFILE_SELECT)
      .single();

    if (linkErr) {
      return { error: linkErr.message, status: 500 };
    }
    return { row: linked };
  }

  const { data: created, error: insertErr } = await sb
    .from("sm_users")
    .insert({
      auth_user_id: authUserId,
      email,
      user_uuid: authUserId
    })
    .select(PROFILE_SELECT)
    .single();

  if (insertErr) {
    return { error: insertErr.message, status: 500 };
  }
  return { row: created };
}

// GET /api/me
router.get("/me", authLoginLimiter, supabaseAuth, async (req, res) => {
  const result = await loadOrCreateSmUser(req.authUser);
  if (result.error) {
    return res.status(result.status || 500).json({ error: result.error });
  }

  return res.json({
    user: toPublicUser(result.row),
    needsProfile: needsProfile(result.row)
  });
});

// PATCH /api/me/profile
router.patch("/me/profile", authLoginLimiter, supabaseAuth, async (req, res) => {
  const { name, profession, country } = req.body || {};
  if (!name || !profession || !country) {
    return res.status(400).json({ error: "Name, profession, and country are required" });
  }

  const sb = getSupabaseAdmin();
  if (!sb) return res.status(503).json({ error: "Database unavailable" });

  const ensure = await loadOrCreateSmUser(req.authUser);
  if (ensure.error) {
    return res.status(ensure.status || 500).json({ error: ensure.error });
  }

  const { data, error } = await sb
    .from("sm_users")
    .update({
      name: String(name).trim(),
      profession: String(profession).trim(),
      country: String(country).trim()
    })
    .eq("auth_user_id", req.authUser.id)
    .select(PROFILE_SELECT)
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({
    user: toPublicUser(data),
    needsProfile: needsProfile(data)
  });
});

export default router;
