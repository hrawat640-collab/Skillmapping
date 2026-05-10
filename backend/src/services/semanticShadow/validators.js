function isBoundedNumber(n) {
  return Number.isFinite(Number(n)) && Number(n) >= 0 && Number(n) <= 1;
}

export function validateMergedSemanticRecord(record) {
  const errors = [];
  const warnings = [];

  if (!record?.role_id) errors.push("missing_role_id");
  if (!record?.canonical_title) errors.push("missing_canonical_title");
  if (!record?.family) errors.push("missing_family");
  if (!record?.archetype) errors.push("missing_archetype");

  const surfaces = record?.ownership_surfaces || {};
  const acts = record?.execution_acts || {};
  for (const [k, v] of Object.entries(surfaces)) {
    if (!isBoundedNumber(v)) errors.push(`invalid_surface_weight:${k}`);
  }
  for (const [k, v] of Object.entries(acts)) {
    if (!isBoundedNumber(v)) errors.push(`invalid_act_weight:${k}`);
  }

  if ((record?.must_have_signals || []).length < 2) warnings.push("low_must_have_signal_count");
  if ((record?.preferred_signals || []).length < 2) warnings.push("low_preferred_signal_count");

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateBundle(records, manifest) {
  const issues = [];
  const seen = new Set();

  for (const record of records || []) {
    const id = String(record?.role_id || "");
    if (!id) continue;
    if (seen.has(id)) issues.push({ severity: "error", code: "duplicate_role_id", role_id: id });
    seen.add(id);

    const check = validateMergedSemanticRecord(record);
    for (const e of check.errors) issues.push({ severity: "error", code: e, role_id: id });
    for (const w of check.warnings) issues.push({ severity: "warning", code: w, role_id: id });
  }

  if (!manifest?.semantic_bundle_version) {
    issues.push({ severity: "error", code: "missing_semantic_bundle_version" });
  }

  return {
    ok: issues.every((i) => i.severity !== "error"),
    issues
  };
}
