export const SHADOW_V1_MANIFEST = {
  semantic_bundle_version: "semantic_bundle_v1",
  template_versions: {
    engineering: "engineering_template_v1.0",
    data_analytics: "data_analytics_template_v1.0",
    design_product: "design_product_template_v1.0",
    hr_people_ops: "hr_people_ops_template_v1.0"
  },
  archetype_versions: {
    engineering: "engineering_archetypes_v1.0",
    data_analytics: "data_analytics_archetypes_v1.0",
    design_product: "design_product_archetypes_v1.0",
    hr_people_ops: "hr_people_ops_archetypes_v1.0"
  },
  validator_pack_version: "shadow_validator_pack_v1",
  ranking_eval_suite_version: "ranking_eval_suite_v1",
  merge_engine_version: "shadow_merge_engine_v1"
};

export const FAMILY_TEMPLATES_V1 = {
  engineering: {
    family: "engineering",
    ownership_surfaces: { backend: 0.6, infrastructure: 0.5, frontend: 0.35, mobile_ui: 0.15 },
    execution_acts: { build: 0.8, integrate: 0.7, automate: 0.6, operate: 0.55, test: 0.25, support: 0.15, document: 0.15 },
    must_have_signals: ["api", "service", "integration", "system"],
    preferred_signals: ["backend", "platform", "distributed", "microservice"],
    suppression_signals: ["support-only", "documentation-only", "qa-only"],
    confidence_profile: { family_only_ceiling: 0.72, family_plus_archetype_ceiling: 0.84, elite_unlock: 0.9 }
  },
  data_analytics: {
    family: "data_analytics",
    ownership_surfaces: { analytics: 0.8, backend: 0.25, infrastructure: 0.15 },
    execution_acts: { analyze: 0.82, build: 0.45, automate: 0.32, support: 0.12, document: 0.1 },
    must_have_signals: ["dashboard", "reporting", "analysis", "trend"],
    preferred_signals: ["bi", "insights", "metrics", "data"],
    suppression_signals: ["support-only", "hr-only"],
    confidence_profile: { family_only_ceiling: 0.74, family_plus_archetype_ceiling: 0.86, elite_unlock: 0.9 }
  },
  design_product: {
    family: "design_product",
    ownership_surfaces: { product_design: 0.82, mobile_ui: 0.55, frontend: 0.28 },
    execution_acts: { design: 0.86, analyze: 0.35, build: 0.2, support: 0.08, document: 0.12 },
    must_have_signals: ["ui", "ux", "interface", "interaction"],
    preferred_signals: ["mobile", "usability", "prototype", "product design"],
    suppression_signals: ["brand-only", "curriculum-only", "backend-heavy"],
    confidence_profile: { family_only_ceiling: 0.7, family_plus_archetype_ceiling: 0.82, elite_unlock: 0.88 }
  },
  hr_people_ops: {
    family: "hr_people_ops",
    ownership_surfaces: { people_ops: 0.84 },
    execution_acts: { operate: 0.66, support: 0.48, analyze: 0.22, document: 0.2 },
    must_have_signals: ["hiring", "employee relations", "performance", "workforce"],
    preferred_signals: ["people", "talent", "hr", "onboarding"],
    suppression_signals: ["engineering-build-only", "design-only"],
    confidence_profile: { family_only_ceiling: 0.76, family_plus_archetype_ceiling: 0.86, elite_unlock: 0.9 }
  }
};

export const ARCHETYPE_OVERRIDES_V1 = {
  engineering: {
    backend_engineer: {
      ownership_surfaces: { backend: 0.95, infrastructure: 0.45, frontend: 0.12, mobile_ui: 0.05 },
      execution_acts: { build: 0.95, integrate: 0.88, automate: 0.52, operate: 0.35, test: 0.1, support: 0.05, document: 0.06 },
      must_have_signals: ["api", "backend", "service"],
      suppression_signals: ["support-only", "qa-only", "mobile-ui-only"]
    },
    platform_engineer: {
      ownership_surfaces: { backend: 0.72, infrastructure: 0.95, frontend: 0.08, mobile_ui: 0.02 },
      execution_acts: { build: 0.65, integrate: 0.68, automate: 0.9, operate: 0.92, test: 0.1, support: 0.1, document: 0.08 },
      must_have_signals: ["platform", "reliability", "infrastructure", "distributed"],
      suppression_signals: ["support-only", "ui-only"]
    },
    integration_engineer: {
      ownership_surfaces: { backend: 0.88, infrastructure: 0.35, frontend: 0.12, mobile_ui: 0.03 },
      execution_acts: { build: 0.72, integrate: 0.96, automate: 0.5, operate: 0.42, test: 0.12, support: 0.08, document: 0.08 },
      must_have_signals: ["integration", "api", "service communication", "orchestration"],
      suppression_signals: ["qa-only", "support-only", "mobile-ui-only"]
    }
  },
  data_analytics: {
    bi_analyst: {
      ownership_surfaces: { analytics: 0.94, backend: 0.12, infrastructure: 0.08 },
      execution_acts: { analyze: 0.94, build: 0.28, automate: 0.22, support: 0.08, document: 0.1 },
      must_have_signals: ["dashboard", "reporting", "bi", "visualization"]
    },
    data_analyst: {
      ownership_surfaces: { analytics: 0.92, backend: 0.1, infrastructure: 0.05 },
      execution_acts: { analyze: 0.92, build: 0.2, automate: 0.16, support: 0.06, document: 0.08 },
      must_have_signals: ["analysis", "trend", "insight", "reporting"]
    },
    analytics_engineer: {
      ownership_surfaces: { analytics: 0.82, backend: 0.52, infrastructure: 0.26 },
      execution_acts: { analyze: 0.74, build: 0.64, automate: 0.6, support: 0.08, document: 0.1 },
      must_have_signals: ["analytics engineering", "data modeling", "dashboard", "sql"]
    }
  },
  design_product: {
    product_designer: {
      ownership_surfaces: { product_design: 0.95, mobile_ui: 0.62, frontend: 0.2 },
      execution_acts: { design: 0.96, analyze: 0.42, build: 0.1, support: 0.05, document: 0.1 },
      must_have_signals: ["product design", "ux", "ui", "interaction"],
      suppression_signals: ["brand-only", "curriculum-only"]
    },
    mobile_ui_designer: {
      ownership_surfaces: { product_design: 0.82, mobile_ui: 0.95, frontend: 0.22 },
      execution_acts: { design: 0.94, analyze: 0.36, build: 0.08, support: 0.05, document: 0.08 },
      must_have_signals: ["mobile", "app interface", "ui", "ux"],
      suppression_signals: ["brand-only", "backend-heavy"]
    },
    ux_researcher: {
      ownership_surfaces: { product_design: 0.88, mobile_ui: 0.44, frontend: 0.1 },
      execution_acts: { design: 0.72, analyze: 0.62, build: 0.04, support: 0.06, document: 0.2 },
      must_have_signals: ["ux research", "usability", "research", "interaction"]
    }
  },
  hr_people_ops: {
    talent_acquisition: {
      ownership_surfaces: { people_ops: 0.92 },
      execution_acts: { operate: 0.62, support: 0.52, analyze: 0.2, document: 0.18 },
      must_have_signals: ["hiring", "talent acquisition", "recruitment"]
    },
    hrbp_employee_relations: {
      ownership_surfaces: { people_ops: 0.95 },
      execution_acts: { operate: 0.76, support: 0.62, analyze: 0.24, document: 0.2 },
      must_have_signals: ["employee relations", "hrbp", "people partner", "performance"]
    },
    people_operations: {
      ownership_surfaces: { people_ops: 0.9 },
      execution_acts: { operate: 0.82, support: 0.46, analyze: 0.28, document: 0.24 },
      must_have_signals: ["people operations", "workforce", "policy", "onboarding"]
    }
  }
};
