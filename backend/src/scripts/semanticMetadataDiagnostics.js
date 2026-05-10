import dotenv from "dotenv";
import {
  generateSemanticMetadataBatch,
  printDiagnosticsReport
} from "../services/semantic/roleSemanticMetadataPipeline.js";

dotenv.config();

async function run() {
  const result = await generateSemanticMetadataBatch({
    dryRun: true,
    strict: false
  });
  printDiagnosticsReport(result, { maxIssuesToPrint: 50 });
}

run().catch((e) => {
  console.error("[semantic-metadata:diagnostics] failed:", e.message || e);
  process.exit(1);
});
