import { loadBundleRegistryEntry } from "../services/semanticShadow/bundleRegistry.js";
import { scoreWithBundleRecords } from "../services/semanticShadow/shadowScoring.js";

function parseArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return null;
  return process.argv[idx + 1] || null;
}

async function run() {
  const bundleHash = parseArg("--bundle-hash");
  const query = parseArg("--query") || "someone who creates and connects APIs";
  if (!bundleHash) {
    throw new Error("Missing --bundle-hash argument");
  }

  const entry = await loadBundleRegistryEntry(bundleHash);
  if (!entry) {
    throw new Error(`Bundle not found for hash: ${bundleHash}`);
  }

  const scored = scoreWithBundleRecords({
    query,
    bundle: entry,
    includeAll: true
  });

  console.log(
    JSON.stringify(
      {
        bundle_hash: bundleHash,
        query,
        semantic_bundle_version: entry?.manifest?.semantic_bundle_version,
        generated_at: entry?.manifest?.generated_at,
        validation_ok: entry?.validation?.ok || false,
        top: scored.top
      },
      null,
      2
    )
  );
}

run().catch((e) => {
  console.error("[replaySemanticShadowBundle] failed:", e?.stack || e?.message || e);
  process.exit(1);
});
