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

function normalizeInputText(v) {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const INPUT_TYPO_NORMALIZATION = Object.freeze({
  hrpb: "hrbp",
  reactjs: "react",
  payrol: "payroll",
  "bussiness intelligence": "business intelligence",
  bussiness: "business"
});

function normalizeWithTypoCorrection(v) {
  const original = normalizeInputText(v);
  if (!original) return { original_input: "", corrected_value: "", typo_corrected: false };
  if (INPUT_TYPO_NORMALIZATION[original]) {
    const corrected = INPUT_TYPO_NORMALIZATION[original];
    return { original_input: original, corrected_value: corrected, typo_corrected: corrected !== original };
  }
  const tokenCorrected = original
    .split(" ")
    .map((w) => INPUT_TYPO_NORMALIZATION[w] || w)
    .join(" ")
    .trim();
  const corrected = INPUT_TYPO_NORMALIZATION[tokenCorrected] || tokenCorrected;
  return { original_input: original, corrected_value: corrected, typo_corrected: corrected !== original };
}

async function detectMissingSkillInputs(sb, skills) {
  const normalized = [...new Set((skills || []).map((s) => normalizeWithTypoCorrection(s).original_input).filter(Boolean))];
  if (!sb || !normalized.length) return { provided: [], unmatched: [], checks: [] };
  const checks = [];
  const unmatched = [];
  for (const s of normalized) {
    const correction = normalizeWithTypoCorrection(s);
    const [{ data: canonicalRows, error: canonicalErr }, { data: aliasRows, error: aliasErr }] = await Promise.all([
      sb.from("skills_v2").select("id").ilike("canonical_name", correction.corrected_value).limit(1),
      sb.from("skill_aliases").select("skill_id").ilike("alias", correction.corrected_value).limit(1)
    ]);
    const known = !canonicalErr && !aliasErr && ((canonicalRows && canonicalRows.length) || (aliasRows && aliasRows.length));
    const row = {
      original_input: correction.original_input,
      corrected_value: correction.corrected_value,
      typo_corrected: correction.typo_corrected,
      resolved: !!known
    };
    checks.push(row);
    if (!known) unmatched.push(row.original_input);
  }
  return { provided: normalized, unmatched, checks };
}

async function detectTitleKnown(sb, rawQuery) {
  const q = normalizeWithTypoCorrection(rawQuery);
  if (!sb || !q.corrected_value) return { provided: q.original_input || "", known: null, correction: q };
  const [{ data: roleRows, error: roleErr }, { data: aliasRows, error: aliasErr }] = await Promise.all([
    sb.from("roles_v2").select("id").ilike("canonical_title", q.corrected_value).limit(1),
    sb.from("role_aliases").select("role_id").ilike("alias", q.corrected_value).limit(1)
  ]);
  const known =
    !roleErr &&
    !aliasErr &&
    (((roleRows && roleRows.length) || 0) > 0 || ((aliasRows && aliasRows.length) || 0) > 0);
  return { provided: q.corrected_value, known, correction: q };
}

async function buildNoResultMetadata(sb, { rawQuery, workflowType, skills, selectedDepartment, currency, limitCount }) {
  try {
    const skillCheck = await detectMissingSkillInputs(sb, Array.isArray(skills) ? skills : []);
    const titleCheck =
      workflowType === "title" ? await detectTitleKnown(sb, rawQuery) : { provided: "", known: null, correction: null };
    return {
      no_result_capture: true,
      workflow_type: workflowType || "auto",
      selected_department: selectedDepartment || null,
      currency: currency || "INR",
      limit_count: Number(limitCount || 10),
      raw_query: String(rawQuery || "").slice(0, 1000),
      input_skills: skillCheck.provided,
      unmatched_skills: skillCheck.unmatched,
      title_query: titleCheck.provided,
      title_known: titleCheck.known,
      unresolved_terms: [
        ...(skillCheck.unmatched || []),
        ...(workflowType === "title" && titleCheck.provided && titleCheck.known === false ? [titleCheck.provided] : [])
      ],
      typo_corrections: {
        title: titleCheck.correction || null,
        skills: skillCheck.checks || []
      }
    };
  } catch {
    return {
      no_result_capture: true,
      metadata_error: "no_result_metadata_failed"
    };
  }
}

async function logSearchQuery({
  sb,
  workflowType,
  rawQuery,
  normalizedQuery,
  detectedSkills,
  inferredRoleIds,
  selectedRoleId,
  resultCount,
  success,
  responseTimeMs,
  failureReason = null,
  metadata = null
}) {
  const client = sb || getSupabaseAdmin();
  if (!client) return;
  try {
    await client.from("search_query_logs").insert({
      workflow_type: workflowType,
      raw_query: rawQuery || "",
      normalized_query: normalizedQuery || "",
      detected_skills: detectedSkills || [],
      inferred_role_ids: inferredRoleIds || [],
      selected_role_id: selectedRoleId || null,
      result_count: Number(resultCount || 0),
      success: !!success,
      failure_reason: failureReason || null,
      response_time_ms: Number(responseTimeMs || 0),
      metadata: metadata || null
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
  const sb = getSupabaseAdmin();
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
      sb,
      workflowType: routedWorkflow,
      rawQuery: params.rawQuery,
      normalizedQuery: response.normalizedQuery,
      detectedSkills: response.detectedSkills,
      inferredRoleIds: dedupedResults.map((r) => r?.role_id).filter(Boolean),
      selectedRoleId,
      resultCount: dedupedResults.length,
      success: dedupedResults.length > 0,
      responseTimeMs: response.responseTimeMs,
      failureReason: dedupedResults.length > 0 ? null : "NO_RESULTS",
      metadata:
        dedupedResults.length > 0
          ? null
          : await buildNoResultMetadata(sb, {
            rawQuery: params.rawQuery,
            workflowType: routedWorkflow,
            skills: params.skills,
            selectedDepartment: params.selectedDepartment,
            currency: params.currency,
            limitCount: params.limitCount
          })
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
      sb,
      workflowType: routedWorkflow,
      rawQuery: params.rawQuery,
      normalizedQuery: params.rawQuery,
      detectedSkills: params.skills,
      inferredRoleIds: [],
      selectedRoleId,
      resultCount: 0,
      success: false,
      responseTimeMs: 0,
      failureReason: "REQUEST_FAILED",
      metadata: {
        no_result_capture: false,
        error_message: String(error?.message || "Search failed").slice(0, 500)
      }
    });
    throw error;
  }
}

