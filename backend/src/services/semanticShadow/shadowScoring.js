import { buildShadowBundle } from "./shadowRuntime.js";

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text) {
  return new Set(normalize(text).split(" ").filter(Boolean));
}

function inferQueryActsAndSurfaces(query) {
  const q = normalize(query);
  const hasAny = (patterns) => patterns.some((p) => p.test(q));
  const acts = {
    build: hasAny([/\bbuild\b/, /\bcreate\b/, /\bdevelop\b/]) ? 1 : 0,
    integrate: hasAny([/\bintegrat/, /\bconnect\b/, /\bapi\b/]) ? 1 : 0,
    analyze: hasAny([/\banaly/, /\btrend\b/, /\bdashboard\b/, /\breport\b/]) ? 1 : 0,
    design: hasAny([/\bdesign\b/, /\bux\b/, /\bui\b/, /\binterface\b/]) ? 1 : 0,
    support: hasAny([/\bsupport\b/, /\bassist\b/]) ? 1 : 0
  };
  const surfaces = {
    backend: hasAny([/\bbackend\b/, /\bapi\b/, /\bservice\b/, /\bkafka\b/, /\bpython\b/]) ? 1 : 0,
    analytics: hasAny([/\banalytics\b/, /\bdashboard\b/, /\bbi\b/, /\binsight\b/]) ? 1 : 0,
    mobile_ui: hasAny([/\bmobile\b/, /\bapp\b/, /\binterface\b/]) ? 1 : 0,
    product_design: hasAny([/\bux\b/, /\bui\b/, /\bdesign\b/]) ? 1 : 0,
    people_ops: hasAny([/\bhr\b/, /\bemployee\b/, /\bpeople\b/, /\brecruit\b/]) ? 1 : 0
  };
  return { acts, surfaces };
}

function dotScore(queryVec, roleVec) {
  let score = 0;
  for (const [k, v] of Object.entries(queryVec || {})) {
    score += Number(v || 0) * Number(roleVec?.[k] || 0);
  }
  return score;
}

export async function scoreWithShadowRuntime({ query, candidateRows = [], includeAll = false }) {
  const bundle = await buildShadowBundle();
  return scoreWithBundleRecords({
    query,
    bundle,
    candidateRows,
    includeAll
  });
}

export function scoreWithBundleRecords({ query, bundle, candidateRows = [], includeAll = false }) {
  const querySignals = inferQueryActsAndSurfaces(query);
  const bundleByRoleId = new Map((bundle.records || []).map((r) => [String(r.role_id), r]));
  const queryTokens = tokenSet(query);

  const scored = (includeAll ? bundle.records : candidateRows)
    .map((row) => {
      const role = includeAll ? row : bundleByRoleId.get(String(row?.role_id));
      if (!role) return null;
      const titleTokens = tokenSet(role.canonical_title);
      const lexicalOverlap = [...queryTokens].filter((t) => titleTokens.has(t)).length / Math.max(queryTokens.size, 1);
      const actScore = dotScore(querySignals.acts, role.execution_acts);
      const surfaceScore = dotScore(querySignals.surfaces, role.ownership_surfaces);
      const raw = 0.34 * lexicalOverlap + 0.36 * actScore + 0.3 * surfaceScore;
      const confidenceCeiling = Number(role?.confidence_profile?.family_plus_archetype_ceiling || 0.85);
      const score = Math.min(confidenceCeiling, raw);

      return {
        role_id: role.role_id,
        canonical_title: role.canonical_title,
        shadow_score: Number(score.toFixed(6)),
        debug: {
          lexicalOverlap: Number(lexicalOverlap.toFixed(6)),
          actScore: Number(actScore.toFixed(6)),
          surfaceScore: Number(surfaceScore.toFixed(6)),
          confidenceCeiling
        }
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.shadow_score - a.shadow_score || a.canonical_title.localeCompare(b.canonical_title));

  return {
    bundle_hash: bundle.bundle_hash,
    manifest: bundle.manifest,
    validation_ok: bundle.validation?.ok,
    top: scored.slice(0, 10),
    total_scored: scored.length
  };
}
