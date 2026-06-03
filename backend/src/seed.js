import dotenv from "dotenv";

dotenv.config();

async function run() {
  console.log("Legacy RoleKeyword seed is deprecated. No action performed.");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
