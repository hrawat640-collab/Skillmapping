function uniq(list) {
  return [...new Set((list || []).map((v) => String(v || "").trim()).filter(Boolean))];
}

function mergeNumericMap(base = {}, override = {}) {
  const out = { ...base };
  for (const [k, v] of Object.entries(override || {})) {
    out[k] = Number(v);
  }
  return out;
}

export function mergeFamilyAndArchetype(familyTemplate, archetypeOverride, role) {
  const merged = {
    role_id: role?.id || role?.role_id || null,
    canonical_title: role?.canonical_title || role?.title || "",
    department_name: role?.department_name || role?.department || "",
    family: familyTemplate?.family || "",
    archetype: role?.archetype || "default",
    ownership_surfaces: mergeNumericMap(familyTemplate?.ownership_surfaces, archetypeOverride?.ownership_surfaces),
    execution_acts: mergeNumericMap(familyTemplate?.execution_acts, archetypeOverride?.execution_acts),
    must_have_signals: uniq([...(familyTemplate?.must_have_signals || []), ...(archetypeOverride?.must_have_signals || [])]),
    preferred_signals: uniq([...(familyTemplate?.preferred_signals || []), ...(archetypeOverride?.preferred_signals || [])]),
    suppression_signals: uniq([...(familyTemplate?.suppression_signals || []), ...(archetypeOverride?.suppression_signals || [])]),
    confidence_profile: {
      ...(familyTemplate?.confidence_profile || {})
    }
  };

  return {
    merged,
    mergeTrace: {
      usedFamilyTemplate: familyTemplate?.family || null,
      usedArchetypeOverride: role?.archetype || null,
      mergeEngineVersion: "shadow_merge_engine_v1"
    }
  };
}
