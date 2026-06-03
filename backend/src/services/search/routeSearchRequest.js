/**
 * routeSearchRequest — unified search orchestrator (Phase 4)
 *
 * G: multi-engine parallel execution (intent+vector, title+skill)
 * I: input sanitization
 * J: per-engine independent timeouts — one engine stalling never blocks the other
 * K: structured per-engine timing logs
 */

import { getSupabaseAdmin } from "../../supabaseClient.js";
import { skillSearchEngine } from "./skillSearchEngine.js";
import { titleSearchEngine } from "./titleSearchEngine.js";
import { semanticIntentEngine } from "./semanticIntentEngine.js";
import { vectorSearchEngine } from "./vectorSearchEngine.js";

// ── I: Input sanitization ──────────────────────────────────────────────────

function sanitizeString(raw, maxLen = 512) {
  return String(raw || "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "") // strip control chars
    .trim()
    .slice(0, maxLen);
}

function sanitizeSkillList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => sanitizeString(s, 80))
    .filter(Boolean)
    .slice(0, 30);
}

// ── J: Per-engine timeout ──────────────────────────────────────────────────

const ENGINE_TIMEOUT_MS = Number(process.env.ENGINE_TIMEOUT_MS || 8000);

/**
 * Wraps an engine call with an independent timeout.
 * On timeout: resolves (not rejects) with empty results so other engines can still succeed.
 */
function withEngineTimeout(enginePromise, engineName) {
  return Promise.race([
    enginePromise,
    new Promise((resolve) =>
      setTimeout(() => {
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "engine_timeout",
            engine: engineName,
            timeout_ms: ENGINE_TIMEOUT_MS
          })
        );
        resolve({ workflowType: engineName, results: [], timedOut: true, responseTimeMs: ENGINE_TIMEOUT_MS });
      }, ENGINE_TIMEOUT_MS)
    )
  ]);
}

// ── Workflow classifier ────────────────────────────────────────────────────

function classifyWorkflow({ workflowType, rawQuery, skills }) {
  if (workflowType === "structured" || workflowType === "skills") return "structured";
  if (workflowType === "title") return "title";
  if (workflowType === "intent" || workflowType === "describe") return "intent";
  if (Array.isArray(skills) && skills.length > 0) return "structured";
  const q = String(rawQuery || "").trim();
  if (!q) return "structured";
  const tokens = q.split(/\s+/).filter(Boolean);
  const hasSentenceSignals = /\b(someone|need|looking|who can|person|for)\b/i.test(q) || tokens.length >= 5;
  if (hasSentenceSignals) return "intent";
  if (tokens.length <= 3) return "title";
  return "intent";
}

// ── Result deduplication & merge ──────────────────────────────────────────

function normalizeCanonicalIdentity(rawTitle, rawDept) {
  const title = String(rawTitle || "")
    .toLowerCase()
    .replace(/\b(senior|sr|junior|jr|lead|principal|staff|associate|intern|manager|head)\b/g, " ")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const dept = String(rawDept || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${dept}::${title}`;
}

function mergeEngineResults(resultSets, limitCount) {
  const byIdentity = new Map();
  for (const rows of resultSets) {
    for (const r of rows || []) {
      const key = normalizeCanonicalIdentity(
        r?.canonical_title || r?.title || "",
        r?.department_name || r?.dept || ""
      );
      const existing = byIdentity.get(key);
      const rScore = Number(r?.final_score || r?.score || 0);
      const eScore = Number(existing?.final_score || existing?.score || 0);
      if (!existing || rScore > eScore) byIdentity.set(key, r);
    }
  }
  return [...byIdentity.values()]
    .sort(
      (a, b) =>
        Number(b?.final_score || b?.score || 0) - Number(a?.final_score || a?.score || 0) ||
        String(a?.canonical_title || a?.title || "").localeCompare(
          String(b?.canonical_title || b?.title || "")
        )
    )
    .slice(0, Math.min(Math.max(1, Number(limitCount || 10)), 50));
}

// ── K: Structured timing log ───────────────────────────────────────────────

function logEngineResult(engine, response, routedWorkflow) {
  if (process.env.NODE_ENV === "production") return;
  console.log(
    JSON.stringify({
      level: "info",
      event: "engine_result",
      engine,
      workflow: routedWorkflow,
      results: (response?.results || []).length,
      elapsed_ms: response?.responseTimeMs ?? null,
      skipped: response?.skipped ?? false,
      timed_out: response?.timedOut ?? false
    })
  );
}

// ── Search query logging ───────────────────────────────────────────────────

async function logSearchQuery({
  workflowType, rawQuery, normalizedQuery, detectedSkills,
  inferredRoleIds, selectedRoleId, resultCount, success, responseTimeMs
}) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  try {
    await sb.from("search_query_logs").insert({
      workflow_type: workflowType,
      raw_query: rawQuery || "",
      normalized_query: normalizedQuery || "",
      detected_skills: detectedSkills || [],
      inferred_role_ids: inferredRoleIds || [],
      selected_role_id: selectedRoleId || null,
      result_count: Number(resultCount || 0),
      success: !!success,
      response_time_ms: Number(responseTimeMs || 0)
    });
  } catch (e) {
    console.warn("search_query_logs insert failed:", e.message || e);
  }
}

// ── Main orchestrator ──────────────────────────────────────────────────────

export async function routeSearchRequest({
  workflowType,
  rawQuery,
  selectedDepartment,
  currency,
  limitCount,
  skills,
  selectedRoleId,
  includeDebug = false
}) {
  // I: sanitize all inputs
  const cleanQuery = sanitizeString(rawQuery);
  const cleanSkills = sanitizeSkillList(skills);
  const cleanDept = sanitizeString(selectedDepartment || "", 128);
  const cleanCurrency = ["INR", "USD"].includes(String(currency || "").toUpperCase())
    ? String(currency).toUpperCase()
    : "INR";
  const cleanLimit = Math.min(Math.max(1, Number(limitCount || 10)), 50);

  const routedWorkflow = classifyWorkflow({ workflowType, rawQuery: cleanQuery, skills: cleanSkills });
  const params = {
    rawQuery: cleanQuery,
    selectedDepartment: cleanDept || null,
    currency: cleanCurrency,
    limitCount: cleanLimit,
    skills: cleanSkills,
    includeDebug: !!includeDebug
  };

  const totalStart = Date.now();

  try {
    let primaryResponse;
    let secondaryResponse = null;

    // G: run engines in parallel where useful
    if (routedWorkflow === "structured") {
      // Skills search — deterministic graph matching, no parallel engine needed
      primaryResponse = await withEngineTimeout(skillSearchEngine(params), "skill");
      logEngineResult("skill", primaryResponse, routedWorkflow);

    } else if (routedWorkflow === "title") {
      // G: title + skill in parallel for better coverage
      const [titleResp, skillResp] = await Promise.all([
        withEngineTimeout(titleSearchEngine(params), "title"),
        withEngineTimeout(skillSearchEngine(params), "skill")
      ]);
      logEngineResult("title", titleResp, routedWorkflow);
      logEngineResult("skill", skillResp, routedWorkflow);
      primaryResponse = titleResp;
      secondaryResponse = skillResp;

    } else {
      // intent — G: semantic + vector in parallel
      const [intentResp, vectorResp] = await Promise.all([
        withEngineTimeout(semanticIntentEngine(params), "intent"),
        withEngineTimeout(vectorSearchEngine(params), "vector")
      ]);
      logEngineResult("intent", intentResp, routedWorkflow);
      logEngineResult("vector", vectorResp, routedWorkflow);
      primaryResponse = intentResp;
      secondaryResponse = vectorResp?.skipped ? null : vectorResp;
    }

    // Merge results from all engines that returned data
    const resultSets = [
      primaryResponse?.results || [],
      ...(secondaryResponse?.results?.length ? [secondaryResponse.results] : [])
    ];
    const merged = mergeEngineResults(resultSets, cleanLimit);

    const totalMs = Date.now() - totalStart;

    await logSearchQuery({
      workflowType: routedWorkflow,
      rawQuery: cleanQuery,
      normalizedQuery: primaryResponse?.normalizedQuery || cleanQuery,
      detectedSkills: primaryResponse?.detectedSkills || cleanSkills,
      inferredRoleIds: merged.map((r) => r?.role_id).filter(Boolean),
      selectedRoleId,
      resultCount: merged.length,
      success: true,
      responseTimeMs: totalMs
    });

    const responsePayload = { workflowType: routedWorkflow, results: merged };

    if (includeDebug) {
      responsePayload.debug = {
        engines: {
          primary: { name: routedWorkflow, results: (primaryResponse?.results || []).length, ms: primaryResponse?.responseTimeMs },
          secondary: secondaryResponse
            ? { name: routedWorkflow === "title" ? "skill" : "vector", results: (secondaryResponse?.results || []).length, ms: secondaryResponse?.responseTimeMs }
            : null
        },
        merged: merged.length,
        totalMs,
        ...(primaryResponse?.debug || {})
      };
    }

    return responsePayload;
  } catch (error) {
    await logSearchQuery({
      workflowType: routedWorkflow,
      rawQuery: cleanQuery,
      normalizedQuery: cleanQuery,
      detectedSkills: cleanSkills,
      inferredRoleIds: [],
      selectedRoleId,
      resultCount: 0,
      success: false,
      responseTimeMs: Date.now() - totalStart
    });
    throw error;
  }
}
