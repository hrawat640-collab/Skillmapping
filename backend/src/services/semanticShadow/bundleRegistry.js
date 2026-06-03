import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const REGISTRY_DIR = path.resolve(process.cwd(), "semantic-bundles", "registry");

function stableStringify(obj) {
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  if (obj && typeof obj === "object") {
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(obj);
}

export function createBundleHash(bundlePayload) {
  const stable = stableStringify(bundlePayload);
  return crypto.createHash("sha256").update(stable).digest("hex");
}

export async function persistBundleRegistryEntry(entry) {
  await fs.mkdir(REGISTRY_DIR, { recursive: true });
  const filename = `${entry.bundle_hash}.json`;
  const outPath = path.join(REGISTRY_DIR, filename);
  await fs.writeFile(outPath, JSON.stringify(entry, null, 2), "utf8");
  return outPath;
}

export async function loadBundleRegistryEntry(bundleHash) {
  const outPath = path.join(REGISTRY_DIR, `${bundleHash}.json`);
  try {
    const raw = await fs.readFile(outPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
