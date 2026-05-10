import express from "express";
import { getSupabaseAdmin } from "../supabaseClient.js";
import { routeSearchRequest } from "../services/search/routeSearchRequest.js";

const router = express.Router();
const SEARCH_TIMEOUT_MS = Number(process.env.SEARCH_TIMEOUT_MS || 12000);

function sanitizePublicResult(row) {
  if (!row || typeof row !== "object") return row;
  const {
    _rank_debug,
    _intent_rank_debug,
    semantic_terms,
    why_matched,
    ...safe
  } = row;
  return safe;
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Search timeout after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}

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

/**
 * POST /search-roles-orchestrated
 * Body:
 * {
 *   workflow_type: "structured" | "intent",
 *   input_text: string,
 *   selected_department: string | null,
 *   currency: "INR" | "USD",
 *   limit_count: number
 * }
 *
 * This is the backend-first orchestration entrypoint for SkillMapper.
 * - structured -> deterministic graph matching (`search_roles_v3`)
 * - intent -> semantic inference (`search_roles_intent_v1`)
 */
router.post("/search-roles-orchestrated", async (req, res) => {
  try {
    if (req.body?.input_text != null && typeof req.body?.input_text !== "string") {
      return res.status(400).json({ error: "input_text must be a string", code: "INVALID_INPUT_TEXT" });
    }
    if (req.body?.workflow_type != null && typeof req.body?.workflow_type !== "string") {
      return res.status(400).json({ error: "workflow_type must be a string", code: "INVALID_WORKFLOW_TYPE" });
    }
    if (req.body?.limit_count != null && !Number.isFinite(Number(req.body?.limit_count))) {
      return res.status(400).json({ error: "limit_count must be numeric", code: "INVALID_LIMIT_COUNT" });
    }
    const workflowType = typeof req.body?.workflow_type === "string" ? req.body.workflow_type : null;
    const inputText = typeof req.body?.input_text === "string" ? req.body.input_text : "";
    const selectedDepartment =
      typeof req.body?.selected_department === "string" ? req.body.selected_department : null;
    const currency = typeof req.body?.currency === "string" ? req.body.currency : "INR";
    const limitCount = Number.isFinite(Number(req.body?.limit_count))
      ? Number(req.body.limit_count)
      : 10;
    const skills = Array.isArray(req.body?.skills) ? req.body.skills : [];
    const selectedRoleId = typeof req.body?.selected_role_id === "string" ? req.body.selected_role_id : null;
    const includeDebug = process.env.NODE_ENV !== "production" && !!req.body?.debug;

    const response = await withTimeout(routeSearchRequest({
      workflowType,
      rawQuery: inputText,
      selectedDepartment,
      currency,
      limitCount,
      skills,
      selectedRoleId,
      includeDebug
    }), SEARCH_TIMEOUT_MS);

    if (includeDebug) {
      return res.json({
        workflow_type: response.workflowType,
        results: response.results || [],
        debug: response.debug || null
      });
    }
    const publicResults = (response.results || []).map(sanitizePublicResult);
    if (!publicResults.length) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "search_zero_results",
          workflow_type: workflowType || "auto",
          input_text: inputText,
          selected_department: selectedDepartment,
          limit_count: limitCount
        })
      );
    }
    return res.json(publicResults);
  } catch (e) {
    const isTimeout = /Search timeout/.test(e?.message || "");
    console.error(
      JSON.stringify({
        level: "error",
        event: "search_request_failed",
        message: e?.message || "Search failed",
        code: isTimeout ? "WORKFLOW_SEARCH_TIMEOUT" : "WORKFLOW_SEARCH_FAILED"
      })
    );
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? "Search timed out. Please retry." : e.message || "Search failed",
      code: isTimeout ? "WORKFLOW_SEARCH_TIMEOUT" : "WORKFLOW_SEARCH_FAILED"
    });
  }
});

export default router;
