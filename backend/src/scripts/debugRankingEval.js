import dotenv from "dotenv";
import { routeSearchRequest } from "../services/search/routeSearchRequest.js";

dotenv.config({ path: new URL("../../.env", import.meta.url).pathname });

const tests = [
  { kind: "skills", label: "Python + Kafka", workflowType: "structured", rawQuery: "Python Kafka", skills: ["Python", "Kafka"] },
  { kind: "skills", label: "React + TypeScript", workflowType: "structured", rawQuery: "React TypeScript", skills: ["React", "TypeScript"] },
  { kind: "skills", label: "Tableau + SQL", workflowType: "structured", rawQuery: "Tableau SQL", skills: ["Tableau", "SQL"] },
  { kind: "skills", label: "Performance Marketing + Meta Ads", workflowType: "structured", rawQuery: "Performance Marketing Meta Ads", skills: ["Performance Marketing", "Meta Ads"] },
  { kind: "describe", label: "someone who creates and connects APIs", workflowType: "intent", rawQuery: "someone who creates and connects APIs", skills: [] },
  { kind: "describe", label: "someone who runs hiring and employee relations", workflowType: "intent", rawQuery: "someone who runs hiring and employee relations", skills: [] },
  { kind: "describe", label: "someone who creates dashboards and analyzes trends", workflowType: "intent", rawQuery: "someone who creates dashboards and analyzes trends", skills: [] },
  { kind: "describe", label: "someone who designs mobile app interfaces", workflowType: "intent", rawQuery: "someone who designs mobile app interfaces", skills: [] }
];

async function run() {
  const out = [];
  for (const t of tests) {
    const res = await routeSearchRequest({
      workflowType: t.workflowType,
      rawQuery: t.rawQuery,
      selectedDepartment: null,
      currency: "INR",
      limitCount: 10,
      skills: t.skills,
      selectedRoleId: null,
      includeDebug: true
    });
    const top5 = (res.results || []).slice(0, 5).map((r, idx) => ({
      rank: idx + 1,
      title: r.canonical_title || r.title,
      dept: r.department_name || r.dept,
      score: Number(r.final_score || 0),
      confidence: r.confidence || "",
      matched_skill_count: Number(r.matched_skill_count || 0),
      required_skills: Array.isArray(r.required_skills) ? r.required_skills.slice(0, 8) : [],
      good_to_have: Array.isArray(r.good_to_have) ? r.good_to_have.slice(0, 8) : [],
      matched_skills: Array.isArray(r.matched_skills) ? r.matched_skills.slice(0, 8) : [],
      rank_debug: r._rank_debug || null,
      intent_rank_debug: r._intent_rank_debug || null,
      why_matched: r.why_matched || ""
    }));
    out.push({
      query: t.label,
      kind: t.kind,
      workflow: res.workflowType,
      engine_debug: res.debug || null,
      top5
    });
  }
  console.log(JSON.stringify(out, null, 2));
}

run().catch((e) => {
  console.error("[debugRankingEval] failed:", e?.stack || e?.message || e);
  process.exit(1);
});
