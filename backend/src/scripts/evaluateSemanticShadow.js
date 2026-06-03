import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { routeSearchRequest } from "../services/search/routeSearchRequest.js";
import { buildShadowBundle } from "../services/semanticShadow/shadowRuntime.js";
import { scoreWithBundleRecords } from "../services/semanticShadow/shadowScoring.js";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const EVAL_SUITE = [
  { label: "Python + Kafka", workflowType: "structured", rawQuery: "Python Kafka", skills: ["Python", "Kafka"] },
  { label: "creates and connects APIs", workflowType: "intent", rawQuery: "someone who creates and connects APIs", skills: [] },
  { label: "dashboards and trends", workflowType: "intent", rawQuery: "someone who creates dashboards and analyzes trends", skills: [] },
  { label: "mobile app interfaces", workflowType: "intent", rawQuery: "someone who designs mobile app interfaces", skills: [] },
  { label: "employee relations", workflowType: "intent", rawQuery: "someone who handles employee relations", skills: [] },
  { label: "hiring and recruiting", workflowType: "intent", rawQuery: "someone who manages hiring and recruiting", skills: [] },
  { label: "business intelligence reporting", workflowType: "intent", rawQuery: "someone who owns business intelligence reporting", skills: [] },
  { label: "distributed backend systems", workflowType: "intent", rawQuery: "someone who builds distributed backend systems", skills: [] }
];

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyLikelyFamily(title, dept) {
  const t = normalize(`${title || ""} ${dept || ""}`);
  if (/\b(hr|hrbp|people|talent|recruit|employee)\b/.test(t)) return "hr_people_ops";
  if (/\b(ux|ui|designer|design|interface|product)\b/.test(t)) return "design_product";
  if (/\b(analyst|analytics|bi|dashboard|insight|report)\b/.test(t)) return "data_analytics";
  if (/\b(engineer|backend|platform|infrastructure|api|developer)\b/.test(t)) return "engineering";
  return "unknown";
}

function inferExpectedFamily(label) {
  const l = normalize(label);
  if (/\b(employee relations|hiring|recruit)\b/.test(l)) return "hr_people_ops";
  if (/\b(mobile app interfaces)\b/.test(l)) return "design_product";
  if (/\b(dashboard|business intelligence|trends)\b/.test(l)) return "data_analytics";
  if (/\b(python|kafka|apis|backend|distributed)\b/.test(l)) return "engineering";
  return "unknown";
}

function confidenceStats(rows) {
  const vals = rows.map((r) => Number(r?.score || 0)).filter((n) => Number.isFinite(n));
  if (!vals.length) return { avg: 0, min: 0, max: 0 };
  const sum = vals.reduce((a, b) => a + b, 0);
  return {
    avg: Number((sum / vals.length).toFixed(6)),
    min: Number(Math.min(...vals).toFixed(6)),
    max: Number(Math.max(...vals).toFixed(6))
  };
}

function toComparableTop(rows) {
  return (rows || []).slice(0, 5).map((r, idx) => {
    const title = r?.canonical_title || r?.title || "";
    const dept = r?.department_name || r?.dept || "";
    return {
      rank: idx + 1,
      role_id: r?.role_id || null,
      title,
      dept,
      family_guess: classifyLikelyFamily(title, dept),
      score: Number(r?.final_score || r?.score || r?.shadow_score || 0),
      confidence: r?.confidence || null,
      rank_debug: r?._rank_debug || null,
      intent_rank_debug: r?._intent_rank_debug || null,
      shadow_debug: r?.debug || null
    };
  });
}

function evaluateCase({ label, baselineTop, shadowTop }) {
  const expectedFamily = inferExpectedFamily(label);
  const baselineTop3 = baselineTop.slice(0, 3);
  const shadowTop3 = shadowTop.slice(0, 3);
  const baselineTop3Ids = baselineTop3.map((r) => String(r?.role_id || ""));
  const shadowTop3Ids = shadowTop3.map((r) => String(r?.role_id || ""));
  const overlapTop3 = baselineTop3Ids.filter((id) => id && shadowTop3Ids.includes(id)).length;

  const baselineFamilyMatches = baselineTop3.filter((r) => r.family_guess === expectedFamily).length;
  const shadowFamilyMatches = shadowTop3.filter((r) => r.family_guess === expectedFamily).length;
  const baselineConfidence = confidenceStats(baselineTop3);
  const shadowConfidence = confidenceStats(shadowTop3);

  const baselineNoisy = baselineTop3.filter((r) => r.family_guess !== expectedFamily && r.family_guess !== "unknown").length;
  const shadowNoisy = shadowTop3.filter((r) => r.family_guess !== expectedFamily && r.family_guess !== "unknown").length;

  let note = "No baseline/shadow evidence available.";
  if (baselineTop3.length || shadowTop3.length) {
    const familyDelta = shadowFamilyMatches - baselineFamilyMatches;
    const noisyDelta = baselineNoisy - shadowNoisy;
    const convictionDelta = Number((shadowConfidence.max - baselineConfidence.max).toFixed(6));
    note = `Expected family=${expectedFamily}. family_match_delta=${familyDelta}, noisy_suppression_delta=${noisyDelta}, conviction_delta=${convictionDelta}.`;
  }

  return {
    expected_family: expectedFamily,
    top3_correctness_proxy: {
      baseline_family_matches: baselineFamilyMatches,
      shadow_family_matches: shadowFamilyMatches
    },
    ownership_alignment_proxy: {
      baseline_top1_family: baselineTop3[0]?.family_guess || "none",
      shadow_top1_family: shadowTop3[0]?.family_guess || "none",
      expected_family: expectedFamily
    },
    family_correctness: {
      baseline_top3_expected_family_ratio: Number((baselineFamilyMatches / Math.max(baselineTop3.length, 1)).toFixed(6)),
      shadow_top3_expected_family_ratio: Number((shadowFamilyMatches / Math.max(shadowTop3.length, 1)).toFixed(6))
    },
    confidence_believability: {
      baseline: baselineConfidence,
      shadow: shadowConfidence
    },
    noisy_role_suppression: {
      baseline_non_expected_count: baselineNoisy,
      shadow_non_expected_count: shadowNoisy
    },
    semantic_conviction: {
      baseline_top3_score_spread: Number((baselineConfidence.max - baselineConfidence.min).toFixed(6)),
      shadow_top3_score_spread: Number((shadowConfidence.max - shadowConfidence.min).toFixed(6))
    },
    retrieval_specificity: {
      baseline_unique_titles_top3: new Set(baselineTop3.map((r) => normalize(r.title))).size,
      shadow_unique_titles_top3: new Set(shadowTop3.map((r) => normalize(r.title))).size
    },
    overlap_comparison: {
      top3_overlap_count: overlapTop3,
      baseline_top3_role_ids: baselineTop3Ids,
      shadow_top3_role_ids: shadowTop3Ids
    },
    suppression_explanation: {
      baseline: baselineTop3.map((r) => r.intent_rank_debug || r.rank_debug).filter(Boolean),
      shadow: shadowTop3.map((r) => r.shadow_debug).filter(Boolean)
    },
    ownership_chain_explanation: {
      baseline_top3_family_guess: baselineTop3.map((r) => r.family_guess),
      shadow_top3_family_guess: shadowTop3.map((r) => r.family_guess)
    },
    notes: note
  };
}

async function run() {
  const out = [];
  const supabaseConfigured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const fallbackBundle = supabaseConfigured ? null : await buildShadowBundle({ forceRefresh: true });

  for (const test of EVAL_SUITE) {
    if (supabaseConfigured) {
      const response = await routeSearchRequest({
        workflowType: test.workflowType,
        rawQuery: test.rawQuery,
        selectedDepartment: null,
        currency: "INR",
        limitCount: 10,
        skills: test.skills,
        selectedRoleId: null,
        includeDebug: true
      });

      const topBaseline = toComparableTop(response.results || []);
      const topShadow = toComparableTop((response?.debug?.shadowRuntime?.top || []).map((r) => ({
        role_id: r?.role_id,
        canonical_title: r?.canonical_title,
        shadow_score: r?.shadow_score,
        debug: r?.debug
      })));

      out.push({
        label: test.label,
        query: test.rawQuery,
        workflow: response.workflowType,
        baseline_top_results: topBaseline,
        shadow_top_results: topShadow,
        case_evaluation: evaluateCase({ label: test.label, baselineTop: topBaseline, shadowTop: topShadow })
      });
    } else {
      const shadowOnly = scoreWithBundleRecords({
        query: test.rawQuery,
        bundle: fallbackBundle,
        includeAll: true
      });
      const topShadow = toComparableTop((shadowOnly.top || []).map((r) => ({
        role_id: r?.role_id,
        canonical_title: r?.canonical_title,
        shadow_score: r?.shadow_score,
        debug: r?.debug
      })));
      out.push({
        label: test.label,
        query: test.rawQuery,
        workflow: test.workflowType,
        baseline_top_results: [],
        shadow_top_results: topShadow,
        case_evaluation: evaluateCase({ label: test.label, baselineTop: [], shadowTop: topShadow }),
        shadow_runtime_meta: {
          offline_mode: true,
          bundle_hash: shadowOnly.bundle_hash
        }
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        suite_version: "ranking_eval_suite_v1",
        supabase_configured: supabaseConfigured,
        generated_at: new Date().toISOString(),
        cases: out
      },
      null,
      2
    )
  );
}

run().catch((e) => {
  console.error("[evaluateSemanticShadow] failed:", e?.stack || e?.message || e);
  process.exit(1);
});
