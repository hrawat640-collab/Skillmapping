-- Lightweight professional-context definitions for canonical skills.
-- Scope: concise operational hints only (1-2 lines), no ontology expansion.

alter table if exists public.skills_v2
  add column if not exists short_definition text;

update public.skills_v2
set short_definition = 'Systems used to manage employee records, payroll, attendance, and HR operations.'
where lower(canonical_name) = 'hris';

update public.skills_v2
set short_definition = 'Distributed event-streaming platform used for real-time data pipelines and backend systems.'
where lower(canonical_name) = 'kafka';

update public.skills_v2
set short_definition = 'Financial planning and analysis for budgeting, forecasting, and business performance tracking.'
where lower(canonical_name) in ('fp&a', 'fpa');

update public.skills_v2
set short_definition = 'Systems used to manage customer relationships, sales pipelines, and account activity.'
where lower(canonical_name) = 'crm';

update public.skills_v2
set short_definition = 'Extract, transform, and load process used to move and prepare data for analytics.'
where lower(canonical_name) = 'etl';

update public.skills_v2
set short_definition = 'Enterprise resource planning systems for finance, operations, procurement, and inventory workflows.'
where lower(canonical_name) = 'erp';

update public.skills_v2
set short_definition = 'Continuous integration and continuous delivery practices for automated build, test, and deployment.'
where lower(canonical_name) in ('ci/cd', 'cicd');

update public.skills_v2
set short_definition = 'Engineering practices that combine development and operations for reliable software delivery.'
where lower(canonical_name) = 'devops';

update public.skills_v2
set short_definition = 'Revenue operations practices aligning sales, marketing, and customer systems for growth execution.'
where lower(canonical_name) = 'revops';

update public.skills_v2
set short_definition = 'Business intelligence platform used for dashboards, reporting, and data-driven decision support.'
where lower(canonical_name) = 'tableau';

update public.skills_v2
set short_definition = 'CRM platform used for sales workflows, account tracking, and customer lifecycle management.'
where lower(canonical_name) = 'salesforce';

