-- Semantic intent search powered primarily by role_semantic_metadata.
-- This function is intended for "Describe What You Need" workflow only.

create or replace function public.search_roles_intent_v1(
  input_text text,
  selected_department text default null,
  currency text default 'INR',
  limit_count int default 10
)
returns table (
  role_id uuid,
  canonical_title text,
  department_name text,
  level_code text,
  level_display text,
  final_score numeric,
  confidence text,
  hint text,
  required_skills text[],
  good_to_have text[],
  aliases text[],
  matched_skills text[],
  missing_skills text[],
  matched_skill_count int,
  missing_skill_count int,
  why_matched text,
  semantic_terms text[],
  percentile_25 numeric,
  percentile_75 numeric,
  benchmark_currency text,
  salary_display text
)
language sql
stable
as $$
with q as (
  select
    lower(trim(coalesce(input_text, ''))) as raw_q,
    lower(trim(coalesce(selected_department, ''))) as sel_dept,
    upper(trim(coalesce(currency, 'INR'))) as cur
),
normalized as (
  select
    trim(regexp_replace(regexp_replace(raw_q, '[^a-z0-9\\s-]+', ' ', 'g'), '\s+', ' ', 'g')) as norm_q,
    sel_dept,
    cur
  from q
),
stop_words as (
  select unnest(array[
    'a','an','the','and','or','for','with','without','to','of','in','on','at','by','from',
    'someone','who','can','could','need','needs','want','wants','looking','hire','hiring',
    'person','people','role','job','create','build','make','do','does','able'
  ]::text[]) as w
),
query_tokens as (
  select distinct tok as token
  from normalized n
  cross join lateral unnest(array_remove(string_to_array(n.norm_q, ' '), '')) tok
  where length(tok) >= 2
    and tok not in (select w from stop_words)
),
token_count as (
  select greatest(count(*), 1)::numeric as cnt from query_tokens
),
semantic_terms as (
  select coalesce(array_agg(token order by token), array[]::text[]) as terms
  from query_tokens
),
dept_norm as (
  select
    case
      when n.sel_dept = '' then null
      else coalesce(
        (
          select d.name
          from departments d
          left join dept_aliases da on da.department_id = d.id
          where lower(d.name) = n.sel_dept
             or lower(da.alias) = n.sel_dept
          limit 1
        ),
        n.sel_dept
      )
    end as canonical_dept
  from normalized n
),
detected_skill_ids as (
  select distinct s.id
  from query_tokens qt
  join skills_v2 s on lower(s.canonical_name) = qt.token
  union
  select distinct s.id
  from query_tokens qt
  join skill_aliases sa on lower(sa.alias) = qt.token
  join skills_v2 s on s.id = sa.skill_id
),
role_base as (
  select distinct
    rsb.id as role_id,
    rv.canonical_title,
    coalesce(rv.role_family, 'General') as department_name,
    rv.hint,
    rsb.level_code,
    rsb.min_exp,
    rsb.max_exp,
    coalesce(rsm.summary, '') as summary,
    coalesce(
      (
        select array_agg(lower(v))
        from jsonb_array_elements_text(
          case when jsonb_typeof(rsm.keywords) = 'array' then rsm.keywords else '[]'::jsonb end
        ) as t(v)
      ),
      array[]::text[]
    ) as keywords,
    coalesce(
      (
        select array_agg(lower(v))
        from jsonb_array_elements_text(
          case when jsonb_typeof(rsm.tools) = 'array' then rsm.tools else '[]'::jsonb end
        ) as t(v)
      ),
      array[]::text[]
    ) as tools,
    coalesce(
      (
        select array_agg(lower(v))
        from jsonb_array_elements_text(
          case when jsonb_typeof(rsm.responsibilities) = 'array' then rsm.responsibilities else '[]'::jsonb end
        ) as t(v)
      ),
      array[]::text[]
    ) as responsibilities,
    coalesce(
      (
        select array_agg(lower(v))
        from jsonb_array_elements_text(
          case when jsonb_typeof(rsm.work_examples) = 'array' then rsm.work_examples else '[]'::jsonb end
        ) as t(v)
      ),
      array[]::text[]
    ) as work_examples,
    coalesce(
      (
        select array_agg(lower(v))
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(rsm.output_types) = 'array'
              then rsm.output_types
            else '[]'::jsonb
          end
        ) as t(v)
      ),
      array[]::text[]
    ) as output_types,
    coalesce(
      (
        select array_agg(lower(v))
        from jsonb_array_elements_text(
          case when jsonb_typeof(rsm.related_roles) = 'array' then rsm.related_roles else '[]'::jsonb end
        ) as t(v)
      ),
      array[]::text[]
    ) as related_roles,
    coalesce(
      (
        select array_agg(lower(v))
        from jsonb_array_elements_text(
          case when jsonb_typeof(rsm.domains) = 'array' then rsm.domains else '[]'::jsonb end
        ) as t(v)
      ),
      array[]::text[]
    ) as domains,
    coalesce(
      (
        select array_agg(lower(v))
        from jsonb_array_elements_text(
          case when jsonb_typeof(rsm.seniority_signals) = 'array' then rsm.seniority_signals else '[]'::jsonb end
        ) as t(v)
      ),
      array[]::text[]
    ) as seniority_signals,
    coalesce(
      (
        select array_agg(lower(v))
        from jsonb_array_elements_text(
          case when jsonb_typeof(rsm.search_phrases) = 'array' then rsm.search_phrases else '[]'::jsonb end
        ) as t(v)
      ),
      array[]::text[]
    ) as search_phrases
  from role_search_base rsb
  join roles_v2 rv on rv.id = rsb.id
  left join role_semantic_metadata rsm on rsm.role_id = rsb.id
  cross join dept_norm dn
  where dn.canonical_dept is null
     or lower(coalesce(rv.role_family, 'general')) = lower(dn.canonical_dept)
),
role_text as (
  select
    rb.*,
    trim(regexp_replace(lower(array_to_string(rb.keywords, ' ')), '[^a-z0-9\\s-]+', ' ', 'g')) as kw_text,
    trim(regexp_replace(lower(array_to_string(rb.search_phrases, ' ')), '[^a-z0-9\\s-]+', ' ', 'g')) as phrase_text,
    trim(regexp_replace(lower(array_to_string(rb.output_types, ' ')), '[^a-z0-9\\s-]+', ' ', 'g')) as output_text,
    trim(regexp_replace(lower(array_to_string(rb.work_examples, ' ')), '[^a-z0-9\\s-]+', ' ', 'g')) as work_text,
    trim(regexp_replace(lower(array_to_string(rb.responsibilities, ' ')), '[^a-z0-9\\s-]+', ' ', 'g')) as resp_text,
    trim(regexp_replace(lower(array_to_string(rb.tools, ' ')), '[^a-z0-9\\s-]+', ' ', 'g')) as tools_text,
    trim(regexp_replace(lower(array_to_string(rb.domains, ' ')), '[^a-z0-9\\s-]+', ' ', 'g')) as domains_text,
    trim(regexp_replace(lower(array_to_string(rb.related_roles, ' ')), '[^a-z0-9\\s-]+', ' ', 'g')) as related_text,
    trim(regexp_replace(lower(array_to_string(rb.seniority_signals, ' ')), '[^a-z0-9\\s-]+', ' ', 'g')) as seniority_text,
    trim(regexp_replace(lower(rb.canonical_title), '[^a-z0-9\\s-]+', ' ', 'g')) as title_text,
    coalesce(
      (select array_agg(distinct lower(ra.alias)) from role_aliases ra where ra.role_id = rb.role_id),
      array[]::text[]
    ) as aliases
  from role_base rb
),
role_scores as (
  select
    rt.*,
    (
      select coalesce(count(*)::numeric / (select cnt from token_count), 0)
      from query_tokens qt
      where position(' ' || qt.token || ' ' in (' ' || rt.kw_text || ' ')) > 0
    ) as keywords_ratio,
    (
      select coalesce(count(*)::numeric / (select cnt from token_count), 0)
      from query_tokens qt
      where position(' ' || qt.token || ' ' in (' ' || rt.phrase_text || ' ')) > 0
    ) as search_phrases_ratio,
    (
      select coalesce(count(*)::numeric / (select cnt from token_count), 0)
      from query_tokens qt
      where position(' ' || qt.token || ' ' in (' ' || rt.output_text || ' ')) > 0
    ) as output_types_ratio,
    (
      select coalesce(count(*)::numeric / (select cnt from token_count), 0)
      from query_tokens qt
      where position(' ' || qt.token || ' ' in (' ' || rt.work_text || ' ')) > 0
    ) as work_examples_ratio,
    (
      select coalesce(count(*)::numeric / (select cnt from token_count), 0)
      from query_tokens qt
      where position(' ' || qt.token || ' ' in (' ' || rt.resp_text || ' ')) > 0
    ) as responsibilities_ratio,
    (
      select coalesce(count(*)::numeric / (select cnt from token_count), 0)
      from query_tokens qt
      where position(' ' || qt.token || ' ' in (' ' || rt.tools_text || ' ')) > 0
    ) as tools_ratio,
    (
      select coalesce(count(*)::numeric / (select cnt from token_count), 0)
      from query_tokens qt
      where position(' ' || qt.token || ' ' in (' ' || rt.domains_text || ' ')) > 0
    ) as domains_ratio,
    (
      select coalesce(count(*)::numeric / (select cnt from token_count), 0)
      from query_tokens qt
      where position(' ' || qt.token || ' ' in (' ' || rt.related_text || ' ')) > 0
    ) as related_roles_ratio,
    (
      select coalesce(count(*)::numeric / (select cnt from token_count), 0)
      from query_tokens qt
      where position(' ' || qt.token || ' ' in (' ' || rt.seniority_text || ' ')) > 0
    ) as seniority_ratio,
    (
      select coalesce(count(*)::numeric / (select cnt from token_count), 0)
      from query_tokens qt
      where position(' ' || qt.token || ' ' in (' ' || rt.title_text || ' ')) > 0
    ) as title_ratio,
    (
      select coalesce(max(
        (
          select coalesce(count(*)::numeric / (select cnt from token_count), 0)
          from query_tokens qt
          where position(' ' || qt.token || ' ' in (' ' || lower(alias_item) || ' ')) > 0
        )
      ), 0)
      from unnest(rt.aliases) alias_item
    ) as alias_ratio,
    (
      select coalesce(max(
        case
          when position(' ' || trim(regexp_replace(lower(sp), '[^a-z0-9\\s-]+', ' ', 'g')) || ' ' in (' ' || (select norm_q from normalized) || ' ')) > 0 then 1
          when position(' ' || (select norm_q from normalized) || ' ' in (' ' || trim(regexp_replace(lower(sp), '[^a-z0-9\\s-]+', ' ', 'g')) || ' ')) > 0 then 1
          else 0
        end
      ), 0)::numeric
      from unnest(rt.search_phrases) sp
    ) as phrase_exact_boost
  from role_text rt
),
skill_stats as (
  select
    rs.role_id,
    array_agg(distinct lower(sk.canonical_name)) filter (where rs.importance = 'required') as req_skills,
    array_agg(distinct lower(sk.canonical_name)) filter (where rs.importance = 'good_to_have') as gth_skills,
    count(*) filter (where rs.importance = 'required') as req_total,
    count(*) filter (where rs.importance = 'good_to_have') as gth_total,
    count(*) filter (where rs.importance = 'required' and rs.skill_id in (select id from detected_skill_ids)) as req_hit,
    count(*) filter (where rs.importance = 'good_to_have' and rs.skill_id in (select id from detected_skill_ids)) as gth_hit
  from role_skills rs
  join skills_v2 sk on sk.id = rs.skill_id
  where rs.role_id in (select role_id from role_scores)
  group by rs.role_id
),
ranked as (
  select
    rs.role_id,
    rs.canonical_title,
    rs.department_name,
    rs.hint,
    rs.level_code,
    rs.min_exp,
    rs.max_exp,
    coalesce(ss.req_skills, array[]::text[]) as req_skills,
    coalesce(ss.gth_skills, array[]::text[]) as gth_skills,
    coalesce(ss.req_hit, 0) as req_hit,
    coalesce(ss.gth_hit, 0) as gth_hit,
    (
      (coalesce(rs.keywords_ratio, 0) * 0.24) +
      (coalesce(rs.search_phrases_ratio, 0) * 0.22) +
      (coalesce(rs.output_types_ratio, 0) * 0.14) +
      (coalesce(rs.work_examples_ratio, 0) * 0.10) +
      (coalesce(rs.responsibilities_ratio, 0) * 0.10) +
      (coalesce(rs.tools_ratio, 0) * 0.08) +
      (coalesce(rs.domains_ratio, 0) * 0.05) +
      (coalesce(rs.related_roles_ratio, 0) * 0.04) +
      (coalesce(rs.seniority_ratio, 0) * 0.03)
    ) as semantic_core_score,
    (
      (greatest(coalesce(rs.title_ratio, 0), coalesce(rs.alias_ratio, 0)) * 0.35) +
      ((case when coalesce(ss.req_total,0)=0 then 0 else ss.req_hit::numeric / ss.req_total::numeric end) * 0.45) +
      ((case when coalesce(ss.gth_total,0)=0 then 0 else ss.gth_hit::numeric / ss.gth_total::numeric end) * 0.20)
    ) as auxiliary_score,
    coalesce(rs.phrase_exact_boost, 0) as phrase_exact_boost
  from role_scores rs
  left join skill_stats ss on ss.role_id = rs.role_id
),
scored as (
  select
    r.*,
    least(
      1.0,
      ((coalesce(r.semantic_core_score, 0) * 0.75) + (coalesce(r.auxiliary_score, 0) * 0.25) + (coalesce(r.phrase_exact_boost, 0) * 0.05))
    )::numeric as final_score
  from ranked r
),
filtered as (
  select *
  from scored
  where final_score >= 0.18
  order by final_score desc, req_hit desc, canonical_title asc
  limit greatest(1, least(limit_count, 50))
),
salary as (
  select
    f.role_id,
    f.level_code,
    cb.percentile_25,
    cb.percentile_75,
    cb.currency
  from filtered f
  cross join normalized n
  left join lateral (
    select b.*
    from compensation_benchmarks_v2 b
    where upper(b.currency) = n.cur
      and (
        lower(b.aggregation_key) = lower(regexp_replace(f.canonical_title, '[^a-z0-9]+', '_', 'g') || '_' || f.level_code)
        or lower(b.aggregation_key) = lower(f.role_id::text || '_' || f.level_code)
        or lower(b.aggregation_key) = lower(regexp_replace(f.canonical_title, '[^a-z0-9]+', '_', 'g'))
      )
    order by
      case
        when lower(b.aggregation_key) = lower(regexp_replace(f.canonical_title, '[^a-z0-9]+', '_', 'g') || '_' || f.level_code) then 0
        when lower(b.aggregation_key) = lower(f.role_id::text || '_' || f.level_code) then 1
        else 2
      end
    limit 1
  ) cb on true
)
select
  f.role_id,
  f.canonical_title,
  f.department_name,
  f.level_code,
  case f.level_code when 'L1' then 'Junior' when 'L2' then 'Mid' when 'L3' then 'Senior' when 'L4' then 'Lead' else 'Mid' end as level_display,
  f.final_score,
  case when f.final_score >= 0.70 then 'high' when f.final_score >= 0.45 then 'medium' else 'low' end as confidence,
  coalesce(f.hint,'') as hint,
  f.req_skills as required_skills,
  f.gth_skills as good_to_have,
  (
    select coalesce(array_agg(distinct ra.alias), array[]::text[])
    from role_aliases ra
    where ra.role_id = f.role_id
  ) as aliases,
  (
    select coalesce(array_agg(distinct lower(sk.canonical_name)), array[]::text[])
    from role_skills rs
    join skills_v2 sk on sk.id = rs.skill_id
    where rs.role_id = f.role_id and rs.skill_id in (select id from detected_skill_ids)
  ) as matched_skills,
  (
    select coalesce(array_agg(distinct lower(sk.canonical_name)), array[]::text[])
    from role_skills rs
    join skills_v2 sk on sk.id = rs.skill_id
    where rs.role_id = f.role_id and rs.importance = 'required' and rs.skill_id not in (select id from detected_skill_ids)
  ) as missing_skills,
  f.req_hit + f.gth_hit as matched_skill_count,
  greatest(0, cardinality(f.req_skills) - f.req_hit) as missing_skill_count,
  (
    'Semantic match via keywords/search_phrases/output_types. Score: ' || round(f.final_score::numeric, 3)::text ||
    ', required skill hit: ' || f.req_hit::text || ', good-to-have hit: ' || f.gth_hit::text
  ) as why_matched,
  (select terms from semantic_terms) as semantic_terms,
  s.percentile_25,
  s.percentile_75,
  coalesce(s.currency, (select cur from normalized)) as benchmark_currency,
  case
    when coalesce(s.currency, (select cur from normalized)) = 'USD' and s.percentile_25 is not null and s.percentile_75 is not null
      then '$' || round(s.percentile_25/1000.0)::int || 'K–$' || round(s.percentile_75/1000.0)::int || 'K'
    when s.percentile_25 is not null and s.percentile_75 is not null
      then '₹' || round(s.percentile_25/100000.0)::int || '–' || round(s.percentile_75/100000.0)::int || 'L'
    else ''
  end as salary_display
from filtered f
left join salary s on s.role_id = f.role_id and s.level_code = f.level_code
order by f.final_score desc, f.req_hit desc, f.canonical_title asc;
$$;

grant execute on function public.search_roles_intent_v1(text, text, text, int) to anon;
grant execute on function public.search_roles_intent_v1(text, text, text, int) to authenticated;

