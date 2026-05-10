const FAMILY_SCOPE = new Set(["engineering", "data_analytics", "design_product", "hr_people_ops"]);

const FAMILY_KEYWORDS = {
  engineering: ["engineer", "backend", "platform", "infrastructure", "developer", "api", "integration"],
  data_analytics: ["analyst", "analytics", "bi", "business intelligence", "reporting", "insight", "dashboard"],
  design_product: ["designer", "ux", "ui", "product design", "interaction", "interface", "prototype"],
  hr_people_ops: ["hr", "hrbp", "people", "talent", "recruit", "employee relations", "people operations"]
};

const ARCHETYPE_RULES = {
  engineering: [
    { key: "integration_engineer", patterns: [/integration/i, /\bapi\b/i, /connect/i] },
    { key: "platform_engineer", patterns: [/platform/i, /infrastructure/i, /sre/i, /reliability/i, /devops/i] },
    { key: "backend_engineer", patterns: [/backend/i, /service/i, /microservice/i, /engineer/i] }
  ],
  data_analytics: [
    { key: "analytics_engineer", patterns: [/analytics engineer/i, /data model/i, /dbt/i] },
    { key: "bi_analyst", patterns: [/\bbi\b/i, /business intelligence/i, /dashboard/i] },
    { key: "data_analyst", patterns: [/data analyst/i, /analysis/i, /reporting/i] }
  ],
  design_product: [
    { key: "mobile_ui_designer", patterns: [/mobile/i, /app/i, /interface/i] },
    { key: "ux_researcher", patterns: [/research/i, /usability/i, /\bux\b/i] },
    { key: "product_designer", patterns: [/product designer/i, /\bux\b/i, /\bui\b/i, /interaction/i] }
  ],
  hr_people_ops: [
    { key: "hrbp_employee_relations", patterns: [/hrbp/i, /employee relations/i, /people partner/i] },
    { key: "talent_acquisition", patterns: [/talent/i, /recruit/i, /hiring/i] },
    { key: "people_operations", patterns: [/people operations/i, /onboarding/i, /workforce/i, /\bhr\b/i] }
  ]
};

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveFamilyAndArchetype(role) {
  const title = normalize(role?.canonical_title || role?.title);
  const dept = normalize(role?.department_name || role?.department || role?.role_family);
  const haystack = `${title} ${dept}`.trim();

  const roleFamily = normalize(role?.role_family);
  const familyFromRoleFamily =
    roleFamily.includes("engineer") ? "engineering" :
    roleFamily.includes("data") || roleFamily.includes("analytics") ? "data_analytics" :
    roleFamily.includes("design") || roleFamily.includes("product") ? "design_product" :
    roleFamily.includes("hr") || roleFamily.includes("people") || roleFamily.includes("talent") ? "hr_people_ops" :
    null;

  if (familyFromRoleFamily && inPhase1FamilyScope(familyFromRoleFamily)) {
    const rules = ARCHETYPE_RULES[familyFromRoleFamily] || [];
    let archetype = rules[rules.length - 1]?.key || "default";
    for (const rule of rules) {
      if (rule.patterns.some((p) => p.test(haystack))) {
        archetype = rule.key;
        break;
      }
    }
    return {
      family: familyFromRoleFamily,
      archetype,
      trace: { haystack, familyKeywordHits: 0, familySource: "role_family" }
    };
  }

  let bestFamily = null;
  let bestHits = -1;
  for (const [family, keywords] of Object.entries(FAMILY_KEYWORDS)) {
    const hits = keywords.reduce((acc, kw) => acc + (haystack.includes(kw) ? 1 : 0), 0);
    if (hits > bestHits) {
      bestHits = hits;
      bestFamily = family;
    }
  }
  if (!bestFamily || !FAMILY_SCOPE.has(bestFamily)) return null;

  const rules = ARCHETYPE_RULES[bestFamily] || [];
  let archetype = rules[rules.length - 1]?.key || "default";
  for (const rule of rules) {
    if (rule.patterns.some((p) => p.test(haystack))) {
      archetype = rule.key;
      break;
    }
  }

  return { family: bestFamily, archetype, trace: { haystack, familyKeywordHits: bestHits, familySource: "keyword" } };
}

export function inPhase1FamilyScope(family) {
  return FAMILY_SCOPE.has(String(family || ""));
}
