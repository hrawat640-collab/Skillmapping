import dotenv from "dotenv";
import { connectDb } from "./db.js";
import { RoleKeyword } from "./models/RoleKeyword.js";

dotenv.config();

const seedRoles = [
  {
    role: "Software Engineer",
    mustHave: ["Python", "AWS", "Data Structures", "Algorithms", "REST APIs"],
    niceToHave: ["Docker", "Kubernetes", "CI/CD"]
  },
  {
    role: "Data Analyst",
    mustHave: ["SQL", "Excel", "Data Visualization", "Statistics"],
    niceToHave: ["Python", "Power BI", "Tableau"]
  },
  {
    role: "Product Manager",
    mustHave: ["Roadmapping", "Stakeholder Management", "Market Research"],
    niceToHave: ["SQL", "A/B Testing", "Analytics"]
  }
];

async function run() {
  await connectDb(process.env.MONGODB_URI);
  for (const role of seedRoles) {
    await RoleKeyword.updateOne({ role: role.role }, role, { upsert: true });
  }
  console.log("Seed complete");
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
