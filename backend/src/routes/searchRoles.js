import express from "express";
import { getSupabaseAdmin } from "../supabaseClient.js";

const router = express.Router();

/**
 * POST /search-roles
 * Body: { "input_text": "..." }
 * Response: JSON array of role objects (strict UI shape from search_roles RPC).
 */
router.post("/search-roles", async (req, res) => {
  const inputText = typeof req.body?.input_text === "string" ? req.body.input_text : "";

  const sb = getSupabaseAdmin();
  if (!sb) {
    return res.status(503).json({
      error: "Search unavailable: configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)."
    });
  }

  try {
    const { data, error } = await sb.rpc("search_roles", {
      input_text: inputText
    });

    if (error) {
      return res.status(500).json({ error: error.message || "search_roles failed" });
    }

    return res.json(Array.isArray(data) ? data : data ?? []);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Search failed" });
  }
});

export default router;
