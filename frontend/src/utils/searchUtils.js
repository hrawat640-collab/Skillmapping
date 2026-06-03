export function parseSalarySegments(raw) {
  if (!raw) return {};
  const segs = {};
  String(raw).split("|").forEach((p) => {
    const t = p.trim();
    if (t.startsWith("₹")) segs.INR = t;
    else if (t.startsWith("$")) segs.USD = t;
  });
  return segs;
}

export function salLevelIsRenderable(data) {
  if (!Array.isArray(data) || data.length < 3) return false;
  const sal = String(data[2] || "").trim();
  if (!sal) return false;
  const segs = parseSalarySegments(sal);
  return !!(segs.INR || segs.USD);
}

export function formatSalDisplay(minYrs, maxYrs, salRaw, currency = "INR") {
  const segs = parseSalarySegments(salRaw);
  let salStr;
  if (currency === "USD" && segs.USD) {
    salStr = segs.USD;
  } else if (currency === "INR" && segs.INR) {
    salStr = segs.INR;
  } else {
    // Fall back to whichever segment exists
    const parts = [];
    if (segs.INR) parts.push(segs.INR);
    if (segs.USD) parts.push(segs.USD);
    salStr = parts.join(" · ") || "—";
  }
  const hasExp = Number.isFinite(Number(minYrs)) || Number.isFinite(Number(maxYrs));
  if (!hasExp) return salStr;
  const min = Number(minYrs);
  const max = Number(maxYrs);
  if (Number.isFinite(min) && Number.isFinite(max)) {
    return `${min}–${max} yrs · ${salStr}`;
  }
  if (Number.isFinite(min)) return `${min}+ yrs · ${salStr}`;
  if (Number.isFinite(max)) return `Up to ${max} yrs · ${salStr}`;
  return salStr;
}

export function mapServerRow(row, querySkills = []) {
  const required = Array.isArray(row?.required_skills) ? row.required_skills : [];
  const nice = Array.isArray(row?.good_to_have) ? row.good_to_have : [];
  const matchedSkills = Array.isArray(row?.matched_skills) ? row.matched_skills : [];
  const matchedSet = new Set(matchedSkills.map((s) => String(s || "").toLowerCase()));
  const matchedReq = required.filter((s) => matchedSet.has(String(s || "").toLowerCase()))
    .map((s) => String(s).toLowerCase());
  const matchedNice = nice.filter((s) => matchedSet.has(String(s || "").toLowerCase()))
    .map((s) => String(s).toLowerCase());

  let score = Number(row?.final_score || 0);
  if (score <= 1) score = Math.round(score * 100);

  return {
    id: row?.role_id ? String(row.role_id) : null,
    title: String(row?.canonical_title || "").trim(),
    dept: String(row?.department_name || "General"),
    role_summary: String(row?.role_summary || "").trim(),
    short_description: String(row?.short_description || row?.description || "").trim(),
    semantic_summary: String(row?.semantic_summary || row?.semantic_metadata_summary || "").trim(),
    hint: String(row?.hiring_hint || row?.insight || row?.hint || "").trim(),
    required,
    nice,
    exp: { junior: [null, null, ""], mid: [null, null, ""], senior: [null, null, ""], lead: [null, null, ""] },
    score: Math.max(0, Math.min(99, Math.round(score))),
    matchedReq,
    matchedNice,
    matched: [...new Set([...matchedReq, ...matchedNice])],
    matchedUserInputs: (querySkills || []).slice(0, 6)
  };
}

export function enrichWithLibrary(mapped, rolesLibrary) {
  if (!mapped?.title || !Array.isArray(rolesLibrary) || !rolesLibrary.length) return mapped;
  const lib = rolesLibrary.find((ro) => {
    if (mapped.id != null && mapped.id !== "" && ro.id != null && String(ro.id) === String(mapped.id))
      return true;
    return String(ro.title || "").toLowerCase() === String(mapped.title || "").toLowerCase();
  });
  if (!lib) return mapped;
  const out = { ...mapped };
  if (lib.exp) out.exp = lib.exp;
  if (!out.role_summary && lib.role_summary) out.role_summary = lib.role_summary;
  if (!out.short_description && lib.short_description) out.short_description = lib.short_description;
  if (!out.semantic_summary && lib.semantic_summary) out.semantic_summary = lib.semantic_summary;
  if (!out.desc && lib.desc) out.desc = lib.desc;
  if (!out.hint && lib.hint) out.hint = lib.hint;
  if (!out.required?.length && lib.required?.length) out.required = [...lib.required];
  if (!out.nice?.length && lib.nice?.length) out.nice = [...lib.nice];
  return out;
}

export function buildSkillFlatList(skills) {
  const seen = new Set();
  const list = [];
  (skills || []).forEach((s) => {
    const name = String(s.name || "").trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      list.push({ s: name, cat: s.category || "General" });
    }
    (s.aliases || []).forEach((alias) => {
      const a = String(alias || "").trim();
      if (a && !seen.has(a.toLowerCase())) {
        seen.add(a.toLowerCase());
        list.push({ s: a, cat: s.category || "General" });
      }
    });
  });
  return list;
}
