import { getSupabaseAdmin } from "../../supabaseClient.js";
import { SHADOW_V1_MANIFEST, FAMILY_TEMPLATES_V1, ARCHETYPE_OVERRIDES_V1 } from "./templatePackV1.js";
import { resolveFamilyAndArchetype, inPhase1FamilyScope } from "./archetypeResolver.js";
import { mergeFamilyAndArchetype } from "./mergeEngine.js";
import { validateBundle } from "./validators.js";
import { createBundleHash, persistBundleRegistryEntry } from "./bundleRegistry.js";

let cache = {
  loaded_at_ms: 0,
  ttl_ms: 5 * 60 * 1000,
  bundle: null
};

async function fetchRolesForPhase1() {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("roles_v2")
    .select("id, canonical_title, role_family")
    .limit(5000);
  if (error) throw error;
  return data || [];
}

export async function buildShadowBundle({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && cache.bundle && now - cache.loaded_at_ms < cache.ttl_ms) {
    return cache.bundle;
  }

  const roles = await fetchRolesForPhase1();
  const records = [];
  const dropped = [];

  for (const role of roles) {
    const resolved = resolveFamilyAndArchetype(role);
    if (!resolved || !inPhase1FamilyScope(resolved.family)) {
      dropped.push({ role_id: role?.id, reason: "out_of_scope" });
      continue;
    }
    const familyTemplate = FAMILY_TEMPLATES_V1[resolved.family];
    const archetypeOverride = ARCHETYPE_OVERRIDES_V1?.[resolved.family]?.[resolved.archetype] || {};
    const { merged, mergeTrace } = mergeFamilyAndArchetype(
      familyTemplate,
      archetypeOverride,
      { ...role, archetype: resolved.archetype }
    );
    merged._trace = { ...mergeTrace, ...resolved.trace };
    records.push(merged);
  }

  const manifest = {
    ...SHADOW_V1_MANIFEST,
    generated_at: new Date(now).toISOString(),
    phase1_family_scope: ["engineering", "data_analytics", "design_product", "hr_people_ops"],
    record_count: records.length
  };
  const validation = validateBundle(records, manifest);
  const payload = { manifest, records, validation, dropped_count: dropped.length };
  const bundle_hash = createBundleHash(payload);

  const registryEntry = {
    ...payload,
    bundle_hash,
    created_at_ms: now
  };
  const registryPath = await persistBundleRegistryEntry(registryEntry);

  cache = {
    ...cache,
    loaded_at_ms: now,
    bundle: { ...registryEntry, registry_path: registryPath }
  };
  return cache.bundle;
}
