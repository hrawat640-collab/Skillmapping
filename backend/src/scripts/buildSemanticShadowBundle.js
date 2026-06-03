import dotenv from "dotenv";
import { buildShadowBundle } from "../services/semanticShadow/shadowRuntime.js";

dotenv.config({ path: new URL("../../.env", import.meta.url).pathname });

async function run() {
  const forceRefresh = process.argv.includes("--force");
  const bundle = await buildShadowBundle({ forceRefresh });
  const summary = {
    bundle_hash: bundle.bundle_hash,
    registry_path: bundle.registry_path,
    generated_at: bundle.manifest?.generated_at,
    semantic_bundle_version: bundle.manifest?.semantic_bundle_version,
    template_versions: bundle.manifest?.template_versions || {},
    archetype_versions: bundle.manifest?.archetype_versions || {},
    records: bundle.records?.length || 0,
    dropped_count: bundle.dropped_count || 0,
    validation_ok: bundle.validation?.ok || false,
    validation_issue_count: bundle.validation?.issues?.length || 0
  };
  console.log(JSON.stringify(summary, null, 2));
}

run().catch((e) => {
  console.error("[buildSemanticShadowBundle] failed:", e?.stack || e?.message || e);
  process.exit(1);
});
