import express from "express";
import jwt from "jsonwebtoken";
import { getSupabaseAdmin } from "../supabaseClient.js";
import { authLoginLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

// ── Google public-key cache ──────────────────────────────────────────────────
// Google rotates keys every ~24 h. We cache for 1 h so verification is a
// local CPU operation instead of an HTTP round-trip on every sign-in.
let _googleKeys = null;
let _googleKeysFetchedAt = 0;
const GOOGLE_KEYS_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getGooglePublicKeys() {
  if (_googleKeys && Date.now() - _googleKeysFetchedAt < GOOGLE_KEYS_TTL_MS) {
    return _googleKeys;
  }
  const r = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  const { keys } = await r.json();
  // Convert JWK → PEM using Node's built-in crypto (available since Node 15).
  const { createPublicKey } = await import("crypto");
  const keyMap = {};
  for (const jwk of keys) {
    try {
      keyMap[jwk.kid] = createPublicKey({ key: jwk, format: "jwk" })
        .export({ type: "spki", format: "pem" });
    } catch {
      // skip malformed keys
    }
  }
  _googleKeys = keyMap;
  _googleKeysFetchedAt = Date.now();
  return keyMap;
}

// Verify a Google ID token locally (no network call after keys are cached).
async function verifyGoogleToken(credential) {
  // Decode header to find which key was used.
  const header = JSON.parse(
    Buffer.from(credential.split(".")[0], "base64url").toString()
  );

  const keys = await getGooglePublicKeys();
  const pubKey = keys[header.kid];
  if (!pubKey) throw new Error("Unknown Google key id: " + header.kid);

  const payload = jwt.verify(credential, pubKey, {
    algorithms: ["RS256"],
    audience: process.env.GOOGLE_CLIENT_ID || undefined,
    issuer: ["accounts.google.com", "https://accounts.google.com"],
  });

  return payload;
}
// Pre-fetch keys at startup so the very first sign-in is also fast.
export function warmupGoogleKeys() {
  getGooglePublicKeys().catch(() => {});
}
// ────────────────────────────────────────────────────────────────────────────

router.post("/", authLoginLimiter, async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: "Missing credential" });

  let payload;
  try {
    payload = await verifyGoogleToken(credential);
  } catch (err) {
    console.warn("Google token verify failed:", err.message);
    return res.status(401).json({ error: "Invalid Google token" });
  }

  if (!payload.email) {
    return res.status(401).json({ error: "Token missing email" });
  }

  const { email, name, picture } = payload;
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: existing, error: lookupErr } = await sb
    .from("sm_users")
    .select("id, name, profession, country")
    .eq("email", email)
    .maybeSingle();

  if (lookupErr) {
    return res.status(500).json({ error: lookupErr.message });
  }

  let userId;
  let isNewUser = false;

  if (existing) {
    userId = existing.id;
    // Fire-and-forget — client doesn't need to wait for this write.
    sb.from("sm_users")
      .update({ name: name || existing.name, last_login: now })
      .eq("id", userId)
      .then(() => {})
      .catch(() => {});
  } else {
    isNewUser = true;
    const { data: ins, error: insErr } = await sb
      .from("sm_users")
      .insert({ email, name: name || "", last_login: now })
      .select("id")
      .single();
    if (insErr) return res.status(500).json({ error: insErr.message });
    userId = ins.id;
  }

  const token = jwt.sign({ sub: userId, email }, process.env.JWT_SECRET, { expiresIn: "30d" });
  const hasProfile = !isNewUser && !!(existing?.profession && existing?.country && existing?.name);

  res.json({
    token,
    user: {
      id: userId,
      email,
      name: existing?.name || name || "",
      picture: picture || null,
      profession: existing?.profession || null,
      country: existing?.country || null,
      needsProfile: !hasProfile
    }
  });
});

router.post("/profile", authLoginLimiter, async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { name, profession, country } = req.body;
  if (!name || !profession || !country) {
    return res.status(400).json({ error: "Name, profession, and country are required" });
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("sm_users")
    .update({
      name: String(name).trim(),
      profession: String(profession).trim(),
      country: String(country).trim()
    })
    .eq("id", decoded.sub);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
