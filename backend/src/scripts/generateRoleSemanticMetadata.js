import dotenv from "dotenv";
import {
  generateSemanticMetadataBatch,
  printDiagnosticsReport
} from "../services/semantic/roleSemanticMetadataPipeline.js";

dotenv.config();

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

async function run() {
  const roleId = getArg("--role-id");
  if (!roleId) {
    throw new Error("Missing required --role-id <uuid> for incremental generation.");
  }

  const result = await generateSemanticMetadataBatch({
    roleId,
    dryRun: false,
    strict: true
  });

  printDiagnosticsReport(result, { maxIssuesToPrint: 10 });
}

run().catch((e) => {
  console.error("[semantic-metadata:generate-one] failed:", e.message || e);
  process.exit(1);
});
