import { getSupabaseAdmin } from "../supabaseClient.js";

function extractBearerToken(req) {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

async function verifySupabaseAccessToken(token) {
  const supabaseUrl = process.env.SUPABASE_URL || "(unset)";
  const tokenReceived = Boolean(token);
  const tokenPreview = token ? token.slice(0, 20) : null;

  console.log(
    JSON.stringify({
      level: "info",
      event: "supabase_auth_verify_start",
      token_received: tokenReceived,
      token_preview: tokenPreview,
      supabase_url: supabaseUrl
    })
  );

  const sb = getSupabaseAdmin();
  if (!sb) {
    console.log(
      JSON.stringify({
        level: "error",
        event: "supabase_auth_verify_failed",
        reason: "Database unavailable",
        supabase_url: supabaseUrl
      })
    );
    return { error: "Database unavailable" };
  }

  const { data, error } = await sb.auth.getUser(token);

  console.log(
    JSON.stringify({
      level: error || !data?.user ? "warn" : "info",
      event: "supabase_auth_get_user_result",
      supabase_url: supabaseUrl,
      get_user_error: error
        ? {
            message: error.message,
            name: error.name,
            status: error.status,
            code: error.code
          }
        : null,
      get_user_data_user: data?.user
        ? {
            id: data.user.id,
            email: data.user.email
          }
        : null
    })
  );

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
