import { getSupabaseAdmin } from "../supabaseClient.js";

function extractBearerToken(req) {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

async function verifySupabaseAccessToken(token) {
  const sb = getSupabaseAdmin();
  if (!sb) return { error: "Database unavailable" };

  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) {
    return { error: error?.message || "Invalid token" };
  }

  const user = data.user;
  const email = String(user.email || "").trim();
  if (!email) {
    return { error: "Token missing email" };
  }

  return {
    authUser: {
      id: String(user.id),
      email
    }
  };
}

/** Requires a valid Supabase access token. Sets req.authUser on success. */
export async function supabaseAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await verifySupabaseAccessToken(token);
    if (result.error) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.authUser = result.authUser;
    return next();
  } catch (e) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "supabase_auth_failed",
        request_id: req.requestId || null,
        message: e?.message || String(e)
      })
    );
    return res.status(401).json({ error: "Unauthorized" });
  }
}

/**
 * Attempts Supabase JWT verification when Bearer token is present.
 * Does not 401 — legacy app JWT and anonymous requests continue to the handler.
 */
export async function optionalSupabaseAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) return next();

  try {
    const result = await verifySupabaseAccessToken(token);
    if (result.authUser) {
      req.authUser = result.authUser;
    }
  } catch {
    // Legacy JWT may still apply in the route handler.
  }
  return next();
}
