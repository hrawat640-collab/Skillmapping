# Semantic Baseline V1 Freeze

- Baseline ID: `semantic_baseline_v1`
- Bundle Version: `semantic_bundle_v1`
- Eval Suite Version: `ranking_eval_suite_v1`
- Supabase Configured: `true`
- Frozen At: `2026-05-09T08:48:29.342Z`

## Frozen Contracts
- Retrieval vocabularies
- Family templates
- Archetypes
- Benchmark suite
- Semantic manifests
- Inheritance contracts
- Retrieval scoring contracts

## Canonical Snapshot Metrics
- Total cases: 8
- Cases with baseline results: 8
- Cases with shadow results: 8
- Avg baseline top1 score: 0.863752
- Avg shadow top1 score: 0.2138

## Canonical Prompt Outputs (Top 3)
### Python + Kafka
- Baseline Top3: Backend Engineer | Data Engineer | Sdet
- Shadow Top3: Software Engineer (Python) | Analytics Engineer | Backend Engineer
- Overlap Top3: 1
- Notes: Expected family=engineering. family_match_delta=0, noisy_suppression_delta=-1, conviction_delta=-0.145909.

### creates and connects APIs
- Baseline Top3: Power Platform Developer | Mulesoft Developer | Salesforce Developer
- Shadow Top3: .Net Developer | Ar / Vr Developer | Blockchain Developer
- Overlap Top3: 0
- Notes: Expected family=engineering. family_match_delta=0, noisy_suppression_delta=0, conviction_delta=-1.

### dashboards and trends
- Baseline Top3: Business Intelligence Analyst | Data Analyst | Excel Automation Specialist
- Shadow Top3: Business Intelligence Analyst | Ai Research Scientist | Business Analyst
- Overlap Top3: 1
- Notes: Expected family=data_analytics. family_match_delta=0, noisy_suppression_delta=0, conviction_delta=-0.6616.

### mobile app interfaces
- Baseline Top3: Business Intelligence Analyst | Game Designer | Instructional Designer
- Shadow Top3: Game Designer | Instructional Designer | Motion Designer
- Overlap Top3: 2
- Notes: Expected family=design_product. family_match_delta=1, noisy_suppression_delta=1, conviction_delta=-0.814.

### employee relations
- Baseline Top3: Recruitment Manager | People Business Partner | People Operations Manager
- Shadow Top3: Recruitment Manager | Talent Acquisition Specialist | Compensation & Benefits Specialist
- Overlap Top3: 1
- Notes: Expected family=hr_people_ops. family_match_delta=-2, noisy_suppression_delta=0, conviction_delta=-0.461834.

### hiring and recruiting
- Baseline Top3: Product Designer | Ux Researcher | Recruitment Manager
- Shadow Top3: Hr Business Partner | Hr Generalist | L&D Manager
- Overlap Top3: 0
- Notes: Expected family=hr_people_ops. family_match_delta=1, noisy_suppression_delta=2, conviction_delta=-0.784428.

### business intelligence reporting
- Baseline Top3: Business Intelligence Analyst | Business Analyst | Excel Automation Specialist
- Shadow Top3: Business Intelligence Analyst | Business Analyst | Ai Research Scientist
- Overlap Top3: 2
- Notes: Expected family=data_analytics. family_match_delta=0, noisy_suppression_delta=0, conviction_delta=-0.875348.

### distributed backend systems
- Baseline Top3: Backend Engineer | Devops Engineer | Embedded Systems Engineer
- Shadow Top3: Backend Engineer | Embedded Systems Engineer | .Net Developer
- Overlap Top3: 2
- Notes: Expected family=engineering. family_match_delta=0, noisy_suppression_delta=0, conviction_delta=-0.4565.
