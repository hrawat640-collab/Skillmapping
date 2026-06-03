-- Match multi-word skills when the full phrase appears in the query (e.g. "employee relations"
-- -> skill "Employee Relations"). Space tokenization alone never produced a single token for that phrase.

create or replace function public.search_roles_v3(
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
    trim(
      regexp_replace(
        regexp_replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(raw_q, 'backend dev', 'backend engineer'),
                      'frontend dev', 'frontend engineer'
                    ),
                    'hr legal', 'hr business partner'
                  ),
                  ' sde ', ' software engineer '
                ),
                ' ml ', ' machine learning '
              ),
              ' ai ', ' artificial intelligence '
            ),
            ' dev ', ' developer '
          ),
          '[^a-z0-9\\s-]+',
          ' ',
          'g'
        ),
        '\s+',
        ' ',
        'g'
      )
    ) as norm_q,
    sel_dept,
    cur
  from q
),
qt as (
  select array_remove(string_to_array(norm_q, ' '), '')::text[] as toks, norm_q, sel_dept, cur
  from normalized
),
token_count as (
  select greatest(count(*), 1)::numeric as cnt
  from qt
  cross join lateral unnest(qt.toks) tok
),
semantic_terms as (
  select array_agg(distinct t) as terms
  from (
    select unnest(toks) as t from qt
    union all
    select sa.alias
    from qt, skill_aliases sa
    where lower(sa.alias) = any(qt.toks)
  ) x
),
dept_norm as (
  select
    case
      when qt.sel_dept = '' then null
      else coalesce(
        (
          select d.name
          from departments d
          left join dept_aliases da on da.department_id = d.id
          where lower(d.name) = qt.sel_dept
             or lower(da.alias) = qt.sel_dept
          limit 1
        ),
        qt.sel_dept
      )
    end as canonical_dept
  from qt
),
matched_skill_ids as (
  select distinct s.id
  from qt
  join lateral unnest(qt.toks) tok on true
  join skills_v2 s on lower(s.canonical_name) = tok
  union
  select distinct s.id
  from qt
  join lateral unnest(qt.toks) tok on true
  join skill_aliases sa on lower(sa.alias) = tok
  join skills_v2 s on s.id = sa.skill_id
  union
  select distinct s.id
  from qt
  join skills_v2 s on
    strpos(trim(s.canonical_name), ' ') > 0
    and strpos(' ' || qt.norm_q || ' ', ' ' || lower(trim(s.canonical_name)) || ' ') > 0
  union
  select distinct s.id
  from qt
  join skill_aliases sa on
    strpos(trim(sa.alias), ' ') > 0
    and strpos(' ' || qt.norm_q || ' ', ' ' || lower(trim(sa.alias)) || ' ') > 0
  join skills_v2 s on s.id = sa.skill_id
),
base as (
  select distinct
    rsb.id as role_id,
    rv.canonical_title,
    coalesce(rv.role_family, 'General') as department_name,
    rv.hint,
    rsb.level_code,
    rsb.min_exp,
    rsb.max_exp
  from role_search_base rsb
  join roles_v2 rv on rv.id = rsb.id
  cross join dept_norm dn
  where dn.canonical_dept is null or lower(coalesce(rv.role_family, 'general')) = lower(dn.canonical_dept)
),
role_terms as (
  select
    b.role_id,
    b.canonical_title,
    b.department_name,
    b.hint,
    b.level_code,
    b.min_exp,
    b.max_exp,
    array_remove(string_to_array(lower(b.canonical_title), ' '), '')::text[] as title_tokens,
    coalesce(
      (select array_agg(distinct lower(ra.alias)) from role_aliases ra where ra.role_id = b.role_id),
      array[]::text[]
    ) as aliases
  from base b
),
scored as (
  select
    rt.*,
    (
      select coalesce(count(*)::numeric / (select cnt from token_count), 0)
      from qt, lateral unnest(qt.toks) qtok
      where qtok = any(rt.title_tokens)
    ) as title_overlap,
    (
      select coalesce(max(
        (
          select coalesce(count(*)::numeric / (select cnt from token_count), 0)
          from qt, lateral unnest(qt.toks) qtok
          where qtok = any(array_remove(string_to_array(alias_item, ' '), ''))
        )
      ), 0)
      from unnest(rt.aliases) alias_item
    ) as alias_overlap
  from role_terms rt
),
skill_stats as (
  select
    s.role_id,
    array_agg(distinct lower(sk.canonical_name)) filter (where rs.importance = 'required') as req_skills,
    array_agg(distinct lower(sk.canonical_name)) filter (where rs.importance = 'good_to_have') as gth_skills,
    count(*) filter (where rs.importance = 'required') as req_total,
    count(*) filter (where rs.importance = 'good_to_have') as gth_total,
    count(*) filter (where rs.importance = 'required' and rs.skill_id in (select id from matched_skill_ids)) as req_hit,
    count(*) filter (where rs.importance = 'good_to_have' and rs.skill_id in (select id from matched_skill_ids)) as gth_hit
  from scored s
  left join role_skills rs on rs.role_id = s.role_id
  left join skills_v2 sk on sk.id = rs.skill_id
  group by s.role_id
),
ranked as (
  select
    s.role_id,
    s.canonical_title,
    s.department_name,
    s.hint,
    s.level_code,
    s.min_exp,
    s.max_exp,
    coalesce(ss.req_skills, array[]::text[]) as req_skills,
    coalesce(ss.gth_skills, array[]::text[]) as gth_skills,
    coalesce(ss.req_hit, 0) as req_hit,
    coalesce(ss.gth_hit, 0) as gth_hit,
    (
      (least(1, s.title_overlap) * 0.45) +
      (least(1, s.alias_overlap) * 0.20) +
      (case when coalesce(ss.req_total,0)=0 then 0 else (ss.req_hit::numeric / ss.req_total::numeric) end * 0.25) +
      (case when coalesce(ss.gth_total,0)=0 then 0 else (ss.gth_hit::numeric / ss.gth_total::numeric) end * 0.10)
    )::numeric as final_score
  from scored s
  left join skill_stats ss on ss.role_id = s.role_id
),
filtered as (
  select *
  from ranked
  where final_score >= 0.20
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
  cross join qt
  left join lateral (
    select b.*
    from compensation_benchmarks_v2 b
    where upper(b.currency) = qt.cur
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
    where rs.role_id = f.role_id and rs.skill_id in (select id from matched_skill_ids)
  ) as matched_skills,
  (
    select coalesce(array_agg(distinct lower(sk.canonical_name)), array[]::text[])
    from role_skills rs
    join skills_v2 sk on sk.id = rs.skill_id
    where rs.role_id = f.role_id and rs.importance = 'required' and rs.skill_id not in (select id from matched_skill_ids)
  ) as missing_skills,
  f.req_hit + f.gth_hit as matched_skill_count,
  greatest(0, cardinality(f.req_skills) - f.req_hit) as missing_skill_count,
  (
    'Matched on title/alias + skills. Required hit: ' || f.req_hit::text || ', good-to-have hit: ' || f.gth_hit::text
  ) as why_matched,
  (select terms from semantic_terms) as semantic_terms,
  s.percentile_25,
  s.percentile_75,
  coalesce(s.currency, (select cur from qt)) as benchmark_currency,
  case
    when coalesce(s.currency, (select cur from qt)) = 'USD' and s.percentile_25 is not null and s.percentile_75 is not null
      then '$' || round(s.percentile_25/1000.0)::int || 'K–$' || round(s.percentile_75/1000.0)::int || 'K'
    when s.percentile_25 is not null and s.percentile_75 is not null
      then '₹' || round(s.percentile_25/100000.0)::int || '–' || round(s.percentile_75/100000.0)::int || 'L'
    else ''
  end as salary_display
from filtered f
left join salary s on s.role_id = f.role_id and s.level_code = f.level_code
order by f.final_score desc, f.req_hit desc, f.canonical_title asc;
$$;

grant execute on function public.search_roles_v3(text, text, text, int) to anon;
grant execute on function public.search_roles_v3(text, text, text, int) to authenticated;
