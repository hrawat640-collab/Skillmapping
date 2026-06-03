import { getSupabaseAdmin } from "../../supabaseClient.js";

const STOP_WORDS = new Set([
  "and","or","the","a","an","for","to","of","in","on","at","by","with","without","from","into","across",
  "specialist","manager","lead","senior","junior","associate","principal","head","director","intern","consultant"
]);

const GENERIC_PHRASES = [
  "cross functional collaboration",
  "deliver high quality work",
  "fast paced environment",
  "end to end ownership",
  "stakeholder management",
  "strong communication skills",
  "best practices",
  "various tools",
  "multiple projects",
  "support business goals",
  "handle tasks as needed"
];

const DEPT_SEMANTIC = {
  engineering: {
    verbs: ["architect", "implement", "integrate", "optimize", "debug", "deploy", "harden", "instrument", "refactor", "scale"],
    outputs: ["production-grade APIs", "event-driven services", "CI/CD pipelines", "infrastructure as code modules", "runbooks", "observability dashboards"],
    outcomes: ["improves system reliability", "reduces latency", "accelerates release cadence", "scales platform capacity", "reduces incident frequency", "improves service uptime SLOs"],
    toolAnchors: ["Kafka", "Kubernetes", "Docker", "Terraform", "Redis", "PostgreSQL", "Prometheus", "Grafana", "Jenkins", "GitHub Actions", "Node.js", "Java", "Python"],
    contaminationTerms: ["quota attainment", "lead nurturing", "sales pipeline", "campaign CTR", "closing deals"]
  },
  design: {
    verbs: ["prototype", "wireframe", "iterate", "validate", "systematize", "handoff", "audit", "synthesize"],
    outputs: ["interactive prototypes", "design system components", "user journey maps", "high-fidelity screens", "accessibility audit reports", "UX research summaries"],
    outcomes: ["improves user task completion", "reduces UX friction", "improves design consistency", "increases feature adoption"],
    toolAnchors: ["Figma", "FigJam", "Adobe XD", "Sketch", "Framer", "Blender", "After Effects", "Miro", "Maze"],
    contaminationTerms: ["quarterly close", "general ledger", "pipeline quota", "data warehouse indexing"]
  },
  analytics: {
    verbs: ["analyze", "model", "forecast", "instrument", "segment", "quantify", "benchmark", "attribute"],
    outputs: ["executive dashboards", "cohort analysis reports", "funnel diagnostics", "forecast models", "experimentation readouts", "KPI scorecards"],
    outcomes: ["improves decision quality", "increases forecast accuracy", "reduces reporting lag", "improves KPI visibility", "improves conversion efficiency"],
    toolAnchors: ["Tableau", "Power BI", "Looker", "SQL", "Python", "R", "dbt", "BigQuery", "Snowflake", "Google Analytics", "Mixpanel"],
    contaminationTerms: ["ad copy", "quota attainment", "sales call scripts", "candidate sourcing"]
  },
  product: {
    verbs: ["prioritize", "define", "validate", "specify", "align", "launch", "triage", "de-risk"],
    outputs: ["PRDs", "roadmaps", "release plans", "success metrics", "backlog briefs", "feature requirement docs"],
    outcomes: ["improves user adoption", "reduces churn", "increases feature usage", "aligns roadmap to strategy", "improves time-to-value"],
    toolAnchors: ["Jira", "Confluence", "Figma", "Amplitude", "Mixpanel", "Notion"],
    contaminationTerms: ["tax filing", "payroll processing", "closing journal entries"]
  },
  marketing: {
    verbs: ["position", "segment", "launch", "optimize", "measure", "experiment", "retarget", "nurture"],
    outputs: ["campaign briefs", "SEO content clusters", "paid media plans", "conversion landing pages", "email automation flows", "attribution reports"],
    outcomes: ["improves qualified pipeline", "increases organic reach", "improves CAC efficiency", "raises conversion rates", "improves MQL to SQL conversion"],
    toolAnchors: ["Google Ads", "Meta Ads", "Google Analytics", "Search Console", "HubSpot", "Marketo", "Mailchimp", "Ahrefs", "SEMrush", "Canva"],
    contaminationTerms: ["kubernetes cluster", "infrastructure provisioning", "database indexing"]
  },
  sales: {
    verbs: ["prospect", "qualify", "pitch", "negotiate", "close", "expand"],
    outputs: ["sales pipeline", "account plans", "proposals", "renewal plans"],
    outcomes: ["increases revenue", "improves win rate", "expands account retention", "improves forecast confidence"],
    contaminationTerms: ["pytest suite", "etl orchestration", "feature flag rollout"]
  },
  hr: {
    verbs: ["source", "assess", "onboard", "coach", "retain", "standardize"],
    outputs: ["hiring plans", "interview scorecards", "policy documentation", "talent programs"],
    outcomes: ["reduces time to hire", "improves quality of hire", "increases employee retention", "improves role clarity"],
    contaminationTerms: ["campaign CTR", "SEO rankings", "database sharding", "CI/CD pipeline"]
  },
  finance: {
    verbs: ["reconcile", "budget", "forecast", "audit", "report", "control", "close", "consolidate", "accrue"],
    outputs: ["financial statements", "variance reports", "budget plans", "audit-ready ledgers", "monthly close packs", "cashflow forecasts", "compliance filings"],
    outcomes: ["improves financial accuracy", "reduces compliance risk", "improves cash visibility", "improves cost discipline", "reduces close-cycle time"],
    toolAnchors: ["SAP", "Oracle ERP", "NetSuite", "Tally", "Excel", "Power BI", "QuickBooks", "Zoho Books"],
    contaminationTerms: ["creative copy", "kafka streams", "candidate outreach"]
  },
  operations: {
    verbs: ["standardize", "coordinate", "streamline", "track", "resolve", "escalate", "dispatch", "triage", "automate"],
    outputs: ["SOPs", "process maps", "service reports", "capacity plans", "SLA scorecards", "incident response playbooks"],
    outcomes: ["improves operational efficiency", "reduces process variance", "improves SLA adherence", "reduces cycle times", "improves service throughput"],
    toolAnchors: ["Asana", "Jira", "ServiceNow", "SAP", "Salesforce", "Zapier", "Power BI", "Excel"],
    contaminationTerms: ["ad targeting", "deep learning model", "general ledger close"]
  },
  default: {
    verbs: ["plan", "execute", "improve", "coordinate", "measure", "deliver", "prioritize", "review"],
    outputs: ["execution plans", "status updates", "quality deliverables", "improvement initiatives", "team dashboards"],
    outcomes: ["improves execution quality", "improves team alignment", "reduces delays", "improves business outcomes", "improves predictability"],
    toolAnchors: ["Excel", "Notion", "Jira"],
    contaminationTerms: []
  }
};

const TOOL_ANCHOR_KEYWORDS = {
  kafka: "Kafka",
  kubernetes: "Kubernetes",
  docker: "Docker",
  terraform: "Terraform",
  redis: "Redis",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  figma: "Figma",
  sketch: "Sketch",
  blender: "Blender",
  tableau: "Tableau",
  powerbi: "Power BI",
  "power bi": "Power BI",
  looker: "Looker",
  salesforce: "Salesforce",
  sap: "SAP",
  oracle: "Oracle ERP",
  netsuite: "NetSuite",
  sql: "SQL",
  python: "Python",
  java: "Java",
  react: "React",
  node: "Node.js",
  dbt: "dbt",
  bigquery: "BigQuery",
  snowflake: "Snowflake",
  mixpanel: "Mixpanel",
  amplitude: "Amplitude",
  serviceNow: "ServiceNow"
};

function normalizeText(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleTokens(title) {
  return normalizeText(title)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

function uniq(list) {
  return [...new Set((list || []).map((x) => String(x || "").trim()).filter(Boolean))];
}

function pickTopSkills(role, max = 8) {
  const weighted = (role.skills || [])
    .slice()
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))
    .map((s) => s.name)
    .filter(Boolean);
  return uniq(weighted).slice(0, max);
}

function inferDeptProfile(roleFamily) {
  const key = normalizeText(roleFamily);
  if (key.includes("engineer")) return DEPT_SEMANTIC.engineering;
  if (key.includes("design") || key.includes("ux") || key.includes("ui") || key.includes("creative")) return DEPT_SEMANTIC.design;
  if (key.includes("data") || key.includes("analytic") || key.includes("bi")) return DEPT_SEMANTIC.analytics;
  if (key.includes("product")) return DEPT_SEMANTIC.product;
  if (key.includes("marketing")) return DEPT_SEMANTIC.marketing;
  if (key.includes("sales")) return DEPT_SEMANTIC.sales;
  if (key.includes("hr") || key.includes("people") || key.includes("talent")) return DEPT_SEMANTIC.hr;
  if (key.includes("finance") || key.includes("account")) return DEPT_SEMANTIC.finance;
  if (key.includes("operation")) return DEPT_SEMANTIC.operations;
  return DEPT_SEMANTIC.default;
}

function selectRelatedRoles(role, allRoles, max = 6) {
  const baseTokens = new Set(toTitleTokens(role.canonical_title));
  const baseSkillSet = new Set((role.skills || []).map((s) => normalizeText(s.name)));
  const sameFamily = allRoles.filter((r) => r.id !== role.id && normalizeText(r.role_family) === normalizeText(role.role_family));
  const scored = sameFamily.map((candidate) => {
    const tokenOverlap = toTitleTokens(candidate.canonical_title).filter((t) => baseTokens.has(t)).length;
    const skillOverlap = (candidate.skills || []).reduce((acc, s) => acc + (baseSkillSet.has(normalizeText(s.name)) ? 1 : 0), 0);
    return { title: candidate.canonical_title, score: tokenOverlap * 2 + skillOverlap };
  });
  return scored.sort((a, b) => b.score - a.score).map((x) => x.title).filter(Boolean).slice(0, max);
}

function looksLikeTool(skillName) {
  const text = normalizeText(skillName);
  const cues = [
    "api", "sql", "python", "java", "react", "node", "aws", "gcp", "azure", "tableau", "excel", "salesforce", "figma",
    "docker", "kubernetes", "kafka", "sap", "oracle", "netsuite", "power bi", "looker", "mixpanel", "amplitude", "blender"
  ];
  return cues.some((c) => text.includes(c));
}

function normalizeToolAnchor(raw) {
  const t = normalizeText(raw);
  for (const [key, canonical] of Object.entries(TOOL_ANCHOR_KEYWORDS)) {
    if (t.includes(normalizeText(key))) return canonical;
  }
  return raw;
}

function enrichTools(role, profile, titleTokens, topSkills) {
  const roleText = `${role.canonical_title || ""} ${role.role_family || ""} ${role.hint || ""}`;
  const inferredFromSkills = topSkills.filter(looksLikeTool).map(normalizeToolAnchor);
  const inferredFromText = Object.entries(TOOL_ANCHOR_KEYWORDS)
    .filter(([k]) => normalizeText(roleText).includes(normalizeText(k)) || titleTokens.includes(normalizeText(k)))
    .map(([, v]) => v);
  return uniq([
    ...inferredFromSkills,
    ...inferredFromText,
    ...(profile.toolAnchors || []),
    ...topSkills.slice(0, 4).map(normalizeToolAnchor)
  ]).slice(0, 12);
}

function buildSpecificResponsibilities(role, verbs, tools) {
  const roleTitle = role.canonical_title || "role";
  return uniq([
    `${verbs[0] || "execute"} scoped initiatives for ${roleTitle} with measurable delivery timelines`,
    tools[0] ? `${verbs[1] || "optimize"} workflows using ${tools[0]} with operational guardrails` : "",
    tools[1] ? `${verbs[2] || "analyze"} performance signals from ${tools[1]} and propose corrective actions` : "",
    role.hint ? `Apply role-specific execution guidance: ${role.hint}` : ""
  ]).slice(0, 10);
}

function buildSpecificWorkExamples(role, tools, outputs) {
  return uniq([
    tools[0] ? `Deliver ${outputs[0] || "core artifacts"} using ${tools[0]} for a live business initiative` : "",
    tools[1] ? `Create a repeatable operating model with ${tools[1]} and track outcome deltas` : "",
    outputs[1] ? `Publish ${outputs[1]} with clear owner, cadence, and adoption metrics` : ""
  ]).slice(0, 8);
}

function buildMetadataForRole(role, allRoles) {
  const profile = inferDeptProfile(role.role_family);
  const topSkills = pickTopSkills(role, 10);
  const titleTokens = toTitleTokens(role.canonical_title);
  const aliases = uniq((role.aliases || []).map((a) => a.alias)).slice(0, 8);
  const tools = enrichTools(role, profile, titleTokens, topSkills);
  const verbs = uniq([
    ...profile.verbs,
    ...titleTokens.filter((t) => ["design", "build", "manage", "analyze", "optimize", "implement", "audit", "forecast", "prototype", "automate"].includes(t)),
    tools[0] ? `operate ${normalizeText(tools[0])}` : "",
    tools[1] ? `govern ${normalizeText(tools[1])}` : ""
  ]).slice(0, 12);
  const outputs = uniq([
    ...profile.outputs,
    tools[0] ? `${tools[0]} implementation artifacts` : "",
    tools[1] ? `${tools[1]} performance reports` : "",
    topSkills[0] ? `${topSkills[0]} delivery pack` : "",
    titleTokens[0] ? `${titleTokens[0]} operating artifacts` : ""
  ]).slice(0, 12);
  const businessOutcomes = uniq([
    ...profile.outcomes,
    tools[0] ? `improves business reliability through ${tools[0]} standardization` : "",
    tools[1] ? `reduces operational risk via ${tools[1]} governance` : "",
    role.hint ? normalizeText(role.hint) : ""
  ]).slice(0, 12);
  const responsibilities = buildSpecificResponsibilities(role, verbs, tools);
  const workExamples = buildSpecificWorkExamples(role, tools, outputs);
  const keywords = uniq([
    role.canonical_title,
    ...aliases,
    ...titleTokens,
    ...topSkills.slice(0, 8)
  ]).slice(0, 20);
  const searchPhrases = uniq([
    role.canonical_title,
    ...aliases,
    `hire ${role.canonical_title}`,
    topSkills[0] ? `${role.canonical_title} ${topSkills[0]}` : "",
    topSkills[1] ? `${role.canonical_title} ${topSkills[1]}` : "",
    tools[0] ? `${role.canonical_title} with ${tools[0]}` : "",
    tools[1] ? `${role.canonical_title} ${tools[1]} specialist` : ""
  ]).slice(0, 20);
  const domains = uniq([role.role_family, ...titleTokens.slice(0, 3)]).slice(0, 8);
  const relatedRoles = selectRelatedRoles(role, allRoles, 8);
  const summary = uniq([role.hint || "", `${role.canonical_title} in ${role.role_family || "General"} context`]).join(" — ");

  return {
    role_id: role.id,
    canonical_title: role.canonical_title,
    summary,
    keywords,
    verbs,
    outputs,
    output_types: outputs,
    business_outcomes: businessOutcomes,
    responsibilities,
    tools: tools.length ? tools : topSkills.slice(0, 6),
    domains,
    work_examples: workExamples,
    search_phrases: searchPhrases,
    related_roles: relatedRoles
  };
}

function jaccard(a, b) {
  const as = new Set((a || []).map((x) => normalizeText(x)));
  const bs = new Set((b || []).map((x) => normalizeText(x)));
  const inter = [...as].filter((x) => bs.has(x)).length;
  const union = new Set([...as, ...bs]).size || 1;
  return inter / union;
}

function validateRoleMetadata(role, metadata, allGeneratedMetadata) {
  const profile = inferDeptProfile(role.role_family);
  const issues = [];
  const titleTokens = toTitleTokens(role.canonical_title);
  const kw = metadata.keywords || [];
  const searchPhrases = metadata.search_phrases || [];
  const joined = normalizeText([...kw, ...searchPhrases, ...(metadata.responsibilities || []), ...(metadata.business_outcomes || [])].join(" "));

  if ((metadata.keywords || []).length < 6) issues.push({ type: "coverage", severity: "warn", message: "Low keyword coverage (<6)." });
  if ((metadata.search_phrases || []).length < 5) issues.push({ type: "coverage", severity: "warn", message: "Low search phrase coverage (<5)." });
  if ((metadata.tools || []).length < 5) issues.push({ type: "coverage", severity: "warn", message: "Low tools coverage (<5)." });
  if ((metadata.verbs || []).length < 6) issues.push({ type: "coverage", severity: "warn", message: "Low verbs richness (<6)." });
  if ((metadata.outputs || []).length < 5) issues.push({ type: "coverage", severity: "warn", message: "Low outputs richness (<5)." });
  if ((metadata.business_outcomes || []).length < 5) issues.push({ type: "coverage", severity: "warn", message: "Low business outcome specificity (<5)." });
  if (titleTokens.length && !titleTokens.some((t) => joined.includes(t))) {
    issues.push({ type: "specificity", severity: "error", message: "Role title semantics missing from metadata." });
  }
  const contaminationHits = profile.contaminationTerms.filter((term) => joined.includes(normalizeText(term)));
  if (contaminationHits.length) {
    issues.push({
      type: "contamination",
      severity: "error",
      message: `Cross-domain contamination detected: ${contaminationHits.join(", ")}`
    });
  }
  const genericHits = GENERIC_PHRASES.filter((phrase) => joined.includes(normalizeText(phrase)));
  if (genericHits.length > 1) {
    issues.push({
      type: "genericity",
      severity: "warn",
      message: `Generic phrase overuse: ${genericHits.join(", ")}`
    });
  }

  const peers = (allGeneratedMetadata || []).filter((m) => m.role_id !== metadata.role_id);
  for (const peer of peers.slice(0, 40)) {
    const overlap = jaccard(metadata.search_phrases, peer.search_phrases);
    if (overlap >= 0.75) {
      issues.push({
        type: "duplication",
        severity: "warn",
        message: `Search phrase overlap too high with role_id ${peer.role_id} (${(overlap * 100).toFixed(0)}%).`
      });
      break;
    }
  }

  return {
    role_id: role.id,
    title: role.canonical_title,
    role_family: role.role_family,
    issue_count: issues.length,
    error_count: issues.filter((i) => i.severity === "error").length,
    warn_count: issues.filter((i) => i.severity !== "error").length,
    issues
  };
}

function buildDiagnostics(generated, validations) {
  const total = generated.length;
  const fieldCoverage = (field) => generated.filter((m) => Array.isArray(m[field]) ? m[field].length : Boolean(m[field])).length;
  const issues = validations.flatMap((v) => v.issues);
  return {
    generated_roles: total,
    coverage: {
      keywords: fieldCoverage("keywords"),
      verbs: fieldCoverage("verbs"),
      outputs: fieldCoverage("outputs"),
      business_outcomes: fieldCoverage("business_outcomes"),
      responsibilities: fieldCoverage("responsibilities"),
      tools: fieldCoverage("tools"),
      domains: fieldCoverage("domains"),
      work_examples: fieldCoverage("work_examples"),
      search_phrases: fieldCoverage("search_phrases"),
      related_roles: fieldCoverage("related_roles")
    },
    validation: {
      roles_with_issues: validations.filter((v) => v.issue_count > 0).length,
      roles_with_errors: validations.filter((v) => v.error_count > 0).length,
      total_issues: issues.length,
      contamination_issues: issues.filter((i) => i.type === "contamination").length,
      genericity_issues: issues.filter((i) => i.type === "genericity").length,
      duplication_issues: issues.filter((i) => i.type === "duplication").length
    }
  };
}

async function fetchRolesWithSignals(sb, options = {}) {
  const query = sb.from("roles_v2").select("id, canonical_title, role_family, hint").order("canonical_title");
  const { data: roles, error: rolesErr } = options.roleId
    ? await query.eq("id", options.roleId).limit(1)
    : await query;
  if (rolesErr) throw new Error(rolesErr.message || "Failed to fetch roles_v2");
  const roleIds = (roles || []).map((r) => r.id);
  if (!roleIds.length) return [];

  const [{ data: aliases, error: aliasesErr }, { data: roleSkills, error: roleSkillsErr }, { data: skills, error: skillsErr }] =
    await Promise.all([
      sb.from("role_aliases").select("role_id, alias").in("role_id", roleIds),
      sb.from("role_skills").select("role_id, skill_id, weight").in("role_id", roleIds),
      sb.from("skills_v2").select("id, canonical_name")
    ]);

  if (aliasesErr) throw new Error(aliasesErr.message || "Failed to fetch role_aliases");
  if (roleSkillsErr) throw new Error(roleSkillsErr.message || "Failed to fetch role_skills");
  if (skillsErr) throw new Error(skillsErr.message || "Failed to fetch skills_v2");

  const skillMap = new Map((skills || []).map((s) => [s.id, s.canonical_name]));
  const aliasesByRole = new Map();
  for (const row of aliases || []) {
    if (!aliasesByRole.has(row.role_id)) aliasesByRole.set(row.role_id, []);
    aliasesByRole.get(row.role_id).push(row);
  }
  const skillsByRole = new Map();
  for (const row of roleSkills || []) {
    if (!skillsByRole.has(row.role_id)) skillsByRole.set(row.role_id, []);
    skillsByRole.get(row.role_id).push({
      id: row.skill_id,
      name: skillMap.get(row.skill_id) || "",
      weight: Number(row.weight || 0)
    });
  }

  return (roles || []).map((r) => ({
    ...r,
    aliases: aliasesByRole.get(r.id) || [],
    skills: skillsByRole.get(r.id) || []
  }));
}

async function upsertWithColumnFallback(sb, rows) {
  if (!rows.length) return { written: 0, dropped_columns: [] };
  const droppedColumns = new Set();
  let payload = rows;
  const onConflictTarget = "role_id";
  const attemptErrors = [];

  function inferValueType(v) {
    if (Array.isArray(v)) return "array";
    if (v === null) return "null";
    return typeof v;
  }

  function payloadShape(sampleRows) {
    const first = sampleRows && sampleRows[0] ? sampleRows[0] : {};
    const keys = Object.keys(first);
    const shape = {};
    for (const k of keys) {
      shape[k] = inferValueType(first[k]);
    }
    return shape;
  }

  function sampleRoleContext(sampleRows) {
    return (sampleRows || []).slice(0, 3).map((r) => ({
      role_id: r && r.role_id ? r.role_id : null,
      summary_preview: r && r.summary ? String(r.summary).slice(0, 120) : ""
    }));
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { error } = await sb.from("role_semantic_metadata").upsert(payload, { onConflict: onConflictTarget });
    if (!error) return { written: payload.length, dropped_columns: [...droppedColumns] };

    const msg = String(error.message || error);
    const details = String(error.details || "");
    const hint = String(error.hint || "");
    const code = String(error.code || "");
    const match = msg.match(/column\s+"([^"]+)"/i) || details.match(/column\s+"([^"]+)"/i);
    const failingColumn = match ? match[1] : null;
    const errorSnapshot = {
      attempt: attempt + 1,
      max_attempts: 8,
      error: {
        message: msg,
        details,
        hint,
        code
      },
      failing_column: failingColumn,
      dropped_columns: [...droppedColumns],
      conflict_target: onConflictTarget,
      payload: {
        row_count: payload.length,
        keys: Object.keys(payload && payload[0] ? payload[0] : {}),
        shape: payloadShape(payload),
        sample_role_context: sampleRoleContext(payload)
      }
    };
    attemptErrors.push(errorSnapshot);
    console.error("[semantic-metadata:upsert] attempt failed", JSON.stringify(errorSnapshot, null, 2));

    if (!match) {
      throw new Error(
        `Upsert failed with non-fallbackable error.\n${JSON.stringify(
          {
            message: msg,
            details,
            hint,
            code,
            conflict_target: onConflictTarget,
            payload_shape: payloadShape(payload),
            sample_role_context: sampleRoleContext(payload)
          },
          null,
          2
        )}`
      );
    }

    const missing = match[1];
    droppedColumns.add(missing);
    payload = payload.map((row) => {
      const clone = { ...row };
      delete clone[missing];
      return clone;
    });
    console.warn(
      "[semantic-metadata:upsert] retrying without missing column",
      JSON.stringify(
        {
          removed_column: missing,
          next_payload_keys: Object.keys(payload && payload[0] ? payload[0] : {}),
          dropped_columns: [...droppedColumns]
        },
        null,
        2
      )
    );
  }
  throw new Error(
    `Upsert failed after fallback attempts.\n${JSON.stringify(
      {
        conflict_target: onConflictTarget,
        dropped_columns: [...droppedColumns],
        final_payload_shape: payloadShape(payload),
        sample_role_context: sampleRoleContext(payload),
        attempts: attemptErrors
      },
      null,
      2
    )}`
  );
}

export async function generateSemanticMetadataBatch(options = {}) {
  const sb = options.supabase || getSupabaseAdmin();
  if (!sb) throw new Error("Supabase is not configured.");

  const roles = await fetchRolesWithSignals(sb, { roleId: options.roleId || null });
  const generated = roles.map((role) => buildMetadataForRole(role, roles));
  const validations = generated.map((meta) => {
    const role = roles.find((r) => r.id === meta.role_id);
    return validateRoleMetadata(role, meta, generated);
  });
  const diagnostics = buildDiagnostics(generated, validations);

  if (!options.dryRun) {
    const strictMode = !!options.strict;
    const hasErrors = validations.some((v) => v.error_count > 0);
    if (strictMode && hasErrors) {
      const failing = validations.filter((v) => v.error_count > 0).map((v) => `${v.title} (${v.error_count} errors)`).slice(0, 10);
      throw new Error(`Strict validation failed for ${failing.length} roles: ${failing.join(", ")}`);
    }
    const upsertInfo = await upsertWithColumnFallback(sb, generated);
    diagnostics.upsert = upsertInfo;
  }

  return { roles, generated, validations, diagnostics };
}

export function printDiagnosticsReport(result, options = {}) {
  const { diagnostics, validations } = result;
  console.log("Semantic Metadata Diagnostics");
  console.log("============================");
  console.log(`Roles processed: ${diagnostics.generated_roles}`);
  console.log(`Coverage (keywords/search_phrases/tools): ${diagnostics.coverage.keywords}/${diagnostics.coverage.search_phrases}/${diagnostics.coverage.tools}`);
  console.log(`Roles with issues: ${diagnostics.validation.roles_with_issues}`);
  console.log(`Roles with errors: ${diagnostics.validation.roles_with_errors}`);
  console.log(`Total issues: ${diagnostics.validation.total_issues}`);
  if (diagnostics.upsert) {
    console.log(`Rows upserted: ${diagnostics.upsert.written}`);
    if ((diagnostics.upsert.dropped_columns || []).length) {
      console.log(`Dropped columns (schema fallback): ${diagnostics.upsert.dropped_columns.join(", ")}`);
    }
  }

  const sample = validations.filter((v) => v.issue_count > 0).slice(0, options.maxIssuesToPrint || 20);
  if (sample.length) {
    console.log("\nValidation samples:");
    for (const row of sample) {
      console.log(`- ${row.title} [${row.role_family}]`);
      for (const issue of row.issues.slice(0, 3)) {
        console.log(`  • (${issue.severity}) ${issue.type}: ${issue.message}`);
      }
    }
  }
}
