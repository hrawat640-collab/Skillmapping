import { getSupabaseAdmin } from "../../supabaseClient.js";
import { skillSearchEngine } from "./skillSearchEngine.js";
import { titleSearchEngine } from "./titleSearchEngine.js";
import { semanticIntentEngine } from "./semanticIntentEngine.js";
import { scoreWithShadowRuntime } from "../semanticShadow/shadowScoring.js";

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

function dedupeResultsAcrossWorkflows(rows, limitCount) {
  const byIdentity = new Map();
  for (const r of rows || []) {
    const key = normalizeCanonicalIdentity(r?.canonical_title || r?.title || "", r?.department_name || r?.dept || "");
    const existing = byIdentity.get(key);
    const rScore = Number(r?.final_score || r?.score || 0);
    const eScore = Number(existing?.final_score || existing?.score || 0);
    if (!existing || rScore > eScore) byIdentity.set(key, r);
  }
  return [...byIdentity.values()]
    .sort((a, b) =>
      Number(b?.final_score || b?.score || 0) - Number(a?.final_score || a?.score || 0) ||
      String(a?.canonical_title || a?.title || "").localeCompare(String(b?.canonical_title || b?.title || ""))
    )
    .slice(0, Math.min(Math.max(1, Number(limitCount || 10)), 50));
}

async function logSearchQuery({
  workflowType,
  rawQuery,
  normalizedQuery,
  detectedSkills,
  inferredRoleIds,
  selectedRoleId,
  resultCount,
  success,
  responseTimeMs
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
    // Logging must never fail the search response.
    console.warn("search_query_logs insert failed:", e.message || e);
  }
}

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
  const routedWorkflow = classifyWorkflow({ workflowType, rawQuery, skills });
  const params = {
    rawQuery: String(rawQuery || ""),
    selectedDepartment: selectedDepartment || null,
    currency: currency || "INR",
    limitCount: Number(limitCount || 10),
    skills: Array.isArray(skills) ? skills : [],
    includeDebug: !!includeDebug
  };

  try {
    let response;
    if (routedWorkflow === "structured") response = await skillSearchEngine(params);
    else if (routedWorkflow === "title") response = await titleSearchEngine(params);
    else response = await semanticIntentEngine(params);

    const dedupedResults = dedupeResultsAcrossWorkflows(response.results || [], params.limitCount);
    let shadowDebug = null;
    if (includeDebug) {
      try {
        const shadow = await scoreWithShadowRuntime({
          query: params.rawQuery,
          candidateRows: dedupedResults,
          includeAll: false
        });
        const baselineTopRoleIds = dedupedResults.slice(0, 5).map((r) => String(r?.role_id || ""));
        const shadowTopRoleIds = (shadow.top || []).slice(0, 5).map((r) => String(r?.role_id || ""));
        shadowDebug = {
          enabled: true,
          bundle_hash: shadow.bundle_hash,
          validation_ok: shadow.validation_ok,
          baseline_top_role_ids: baselineTopRoleIds,
          shadow_top_role_ids: shadowTopRoleIds,
          overlap_top5: baselineTopRoleIds.filter((id) => shadowTopRoleIds.includes(id)).length,
          top: shadow.top
        };
      } catch (shadowError) {
        shadowDebug = {
          enabled: false,
          error: shadowError?.message || String(shadowError)
        };
      }
    }
    await logSearchQuery({
      workflowType: routedWorkflow,
      rawQuery: params.rawQuery,
      normalizedQuery: response.normalizedQuery,
      detectedSkills: response.detectedSkills,
      inferredRoleIds: dedupedResults.map((r) => r?.role_id).filter(Boolean),
      selectedRoleId,
      resultCount: dedupedResults.length,
      success: true,
      responseTimeMs: response.responseTimeMs
    });

    const responsePayload = {
      workflowType: routedWorkflow,
      results: dedupedResults
    };
    if (includeDebug) {
      responsePayload.debug = {
        ...(response.debug || {}),
        shadowRuntime: shadowDebug,
        crossWorkflowDedupe: {
          before: (response.results || []).length,
          after: dedupedResults.length
        }
      };
    }
    return responsePayload;
  } catch (error) {
    await logSearchQuery({
      workflowType: routedWorkflow,
      rawQuery: params.rawQuery,
      normalizedQuery: params.rawQuery,
      detectedSkills: params.skills,
      inferredRoleIds: [],
      selectedRoleId,
      resultCount: 0,
      success: false,
      responseTimeMs: 0
    });
    throw error;
  }
}

