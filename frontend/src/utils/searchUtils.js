/**
 * Parse a salary pipe string "₹8-18L|$10-20K" into raw string segments.
 * Returns { INR: "₹8-18L", USD: "$10-20K" } — raw strings as in the pipe.
 */
export function parseSalarySegments(raw) {
  if (!raw) return {};
  const map = {};
  String(raw).split("|").forEach((seg) => {
    seg = seg.trim();
    if (!seg) return;
    if (seg.startsWith("₹")) map["INR"] = seg;
    else if (seg.startsWith("$")) map["USD"] = seg;
    else if (/\d/.test(seg) && /[lL](akhs?)?\b|[lL]$/.test(seg)) map["INR"] = "₹" + seg.replace(/^₹+/, "");
    else if (/\d/.test(seg) && /[kK]\b|[kK]$/.test(seg)) map["USD"] = seg.startsWith("$") ? seg : "$" + seg.replace(/^\$/, "");
  });
  return map;
}

/**
 * Format a salary pipe string for display.
 * currency: "INR" | "USD" — returns the raw segment string for that currency.
 */
export function formatSalDisplay(pipe, currency = "INR") {
  const segs = parseSalarySegments(pipe);
  return segs[currency] || null;
}

/**
 * Returns display string showing all available currencies separated by " · ".
 */
export function formatSalDisplayAll(pipe) {
  const segs = parseSalarySegments(pipe);
  return ["INR", "USD"].map((c) => segs[c] || "").filter(Boolean).join(" · ");
}

/**
 * True if the salary pipe has any renderable value for the given currency.
 */
export function salLevelIsRenderable(pipe, currency = "INR") {
  const segs = parseSalarySegments(pipe);
  return currency === "USD" ? !!segs["USD"] : !!segs["INR"];
}

/**
 * Enrich search API results with full role data from the client-side library.
 * API results may be sparse — merge in title, skills, exp, salary, hint etc.
 * Falls back to title matching when IDs differ (roles vs roles_v2 tables).
 */
export function enrichWithLibrary(apiResults, roles) {
  if (!apiResults?.length || !roles?.length) return apiResults || [];

  const byId = new Map(roles.map((r) => [String(r.id), r]));
  const byTitle = new Map(roles.map((r) => [String(r.title || "").toLowerCase().trim(), r]));

  return apiResults.map((result) => {
    const rid = String(result?.role_id || result?.id || "");
    const titleKey = String(result?.canonical_title || result?.title || "").toLowerCase().trim();
    const lib = byId.get(rid) || byTitle.get(titleKey);
    if (!lib) return result;

    return {
      ...result,
      id: rid,
      title: lib.title || result.canonical_title || result.title || "",
      canonical_title: lib.title || result.canonical_title || "",
      dept: lib.dept || result.department_name || result.dept || "",
      department_name: lib.dept || result.department_name || "",
      desc: lib.desc || result.desc || "",
      role_summary: lib.role_summary || result.role_summary || "",
      short_description: lib.short_description || result.short_description || "",
      semantic_summary: lib.semantic_summary || result.semantic_summary || "",
      hint: lib.hint || result.hint || "",
      cvTip: lib.cvTip || result.cvTip || "",
      required: lib.required?.length ? lib.required : (result.required_skills || result.required || []),
      nice: lib.nice?.length ? lib.nice : (result.good_to_have || result.nice || []),
      keywords: lib.keywords || result.keywords || [],
      aliases: lib.aliases?.length ? lib.aliases : (result.aliases || []),
      exp: lib.exp || result.exp || {},
      final_score: result.final_score || result.score || 0
    };
  });
}

/**
 * Build a TalentXRay search URL from a role and user.
 */
export function buildTalentXRayUrl(role, user, txrBase = "https://talentxray.talentsradar.com") {
  const title = encodeURIComponent(role.title || role.canonical_title || "");
  const alt = (role.aliases || []).slice(0, 2).map(encodeURIComponent).join(",");
  const skillList = [
    ...(role.required || []).slice(0, 6),
    ...(role.nice || []).slice(0, 2)
  ].join(",");
  const skills = encodeURIComponent(skillList);
  const au = encodeURIComponent(user?.email || "");
  return `${txrBase}/?title=${title}&alt=${alt}&skills=${skills}&from=skillmapper&au=${au}`;
}
