-- Production hardening for SkillMapper search architecture.
-- 1) Ensure role_semantic_metadata has required JSONB columns + future vector column.
-- 2) Ensure performance indexes for role_skills and semantic JSONB fields.

alter table if exists public.role_semantic_metadata
  add column if not exists keywords jsonb default '[]'::jsonb,
  add column if not exists search_phrases jsonb default '[]'::jsonb,
  add column if not exists responsibilities jsonb default '[]'::jsonb,
  add column if not exists work_examples jsonb default '[]'::jsonb,
  add column if not exists tools jsonb default '[]'::jsonb,
  add column if not exists outputs jsonb default '[]'::jsonb,
  add column if not exists business_outcomes jsonb default '[]'::jsonb,
  add column if not exists verbs jsonb default '[]'::jsonb;

-- Optional future-ready vector storage (enabled only if pgvector is available).
do $$
begin
  begin
    create extension if not exists vector;
  exception when others then
    null;
  end;

  if exists (select 1 from pg_extension where extname = 'vector') then
    begin
      alter table public.role_semantic_metadata
        add column if not exists embedding vector(1536);
    exception when others then
      null;
    end;
  end if;
end $$;

create index if not exists idx_role_skills_role_id on public.role_skills(role_id);
create index if not exists idx_role_skills_skill_id on public.role_skills(skill_id);
create index if not exists idx_role_skills_weight on public.role_skills(weight);

create index if not exists idx_rsm_keywords_gin on public.role_semantic_metadata using gin (keywords);
create index if not exists idx_rsm_search_phrases_gin on public.role_semantic_metadata using gin (search_phrases);
create index if not exists idx_rsm_responsibilities_gin on public.role_semantic_metadata using gin (responsibilities);
create index if not exists idx_rsm_work_examples_gin on public.role_semantic_metadata using gin (work_examples);
create index if not exists idx_rsm_tools_gin on public.role_semantic_metadata using gin (tools);
create index if not exists idx_rsm_outputs_gin on public.role_semantic_metadata using gin (outputs);
create index if not exists idx_rsm_business_outcomes_gin on public.role_semantic_metadata using gin (business_outcomes);
create index if not exists idx_rsm_verbs_gin on public.role_semantic_metadata using gin (verbs);

