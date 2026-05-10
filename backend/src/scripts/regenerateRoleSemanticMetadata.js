import dotenv from "dotenv";
import {
  generateSemanticMetadataBatch,
  printDiagnosticsReport
} from "../services/semantic/roleSemanticMetadataPipeline.js";

dotenv.config();

function hasFlag(name) {
  return process.argv.includes(name);
}

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

async function run() {
  const dryRun = hasFlag("--dry-run");
  const strict = hasFlag("--strict");
  const roleId = getArg("--role-id");

  const result = await generateSemanticMetadataBatch({
    dryRun,
    strict,
    roleId: roleId || null
  });

  printDiagnosticsReport(result);
}

run().catch((e) => {
  console.error("[semantic-metadata:regenerate] failed:", e.message || e);
  process.exit(1);
});
