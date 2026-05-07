-- Deterministic token-overlap search using role_search_base as anchor.
-- Output contract remains fixed for existing UI rendering.
CREATE OR REPLACE FUNCTION public.search_roles(input_text text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF input_text IS NULL OR btrim(input_text) = '' THEN
    RETURN '[]'::jsonb;
  END IF;

  WITH prep AS (
    SELECT
      btrim(
        translate(
          lower(input_text),
          '!@#$%^&*()_+=[]{}|;:''",.<>?/`~\',
          '                               '
        )
      ) AS clean_text
  ),
  prep2 AS (
    SELECT
      (' ' || clean_text || ' ') AS padded,
      CASE
        WHEN (' ' || clean_text || ' ') LIKE '% junior %' OR (' ' || clean_text || ' ') LIKE '% entry %' THEN 'L1'
        WHEN (' ' || clean_text || ' ') LIKE '% mid %' THEN 'L2'
        WHEN (' ' || clean_text || ' ') LIKE '% senior %' THEN 'L3'
        WHEN (' ' || clean_text || ' ') LIKE '% lead %' THEN 'L4'
        ELSE NULL
      END AS lvl_filter
    FROM prep
  ),
  synonyms AS (
    SELECT
      btrim(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(padded, ' backend dev ', ' backend engineer '),
                    ' frontend dev ', ' frontend engineer '
                  ),
                  ' hr legal ', ' hr business partner '
                ),
                ' sde ', ' software engineer '
              ),
              ' ml ', ' machine learning '
            ),
            ' ai ', ' artificial intelligence '
          ),
          ' dev ', ' developer '
        )
      ) AS syn_text,
      lvl_filter
    FROM prep2
  ),
  input_tokens AS (
    SELECT DISTINCT tok AS token
    FROM synonyms s
    CROSS JOIN LATERAL unnest(array_remove(string_to_array(s.syn_text, ' '), '')) tok
    WHERE length(tok) >= 2
  ),
  token_count AS (
    SELECT GREATEST(COUNT(*), 1)::numeric AS cnt FROM input_tokens
  ),
  extracted_skill_ids AS (
    SELECT DISTINCT sv.id
    FROM skills_v2 sv
    CROSS JOIN synonyms s
    WHERE (' ' || s.syn_text || ' ') LIKE '% ' || lower(btrim(sv.canonical_name)) || ' %'
  ),
  base_roles AS (
    SELECT DISTINCT rsb.id, rsb.canonical_title, COALESCE(rsb.hint, '') AS hint
    FROM role_search_base rsb
    CROSS JOIN synonyms s
    WHERE s.lvl_filter IS NULL
       OR EXISTS (
         SELECT 1
         FROM role_search_base l
         WHERE l.id = rsb.id
           AND l.level_code = s.lvl_filter
       )
  ),
  title_score AS (
    SELECT
      br.id,
      LEAST(
        1.0::numeric,
        GREATEST(
          CASE
            WHEN (' ' || lower(br.canonical_title) || ' ') LIKE '% ' || (SELECT syn_text FROM synonyms) || ' %'
              OR (' ' || (SELECT syn_text FROM synonyms) || ' ') LIKE '% ' || lower(br.canonical_title) || ' %'
            THEN 1.0::numeric
            ELSE 0.0::numeric
          END,
          (
            SELECT COUNT(*)::numeric / (SELECT cnt FROM token_count)
            FROM input_tokens it
            WHERE (' ' || lower(br.canonical_title) || ' ') LIKE '% ' || it.token || ' %'
          )
        )
      ) AS score_part
    FROM base_roles br
  ),
  alias_score AS (
    SELECT
      br.id,
      COALESCE(
        MAX(
          LEAST(
            1.0::numeric,
            GREATEST(
              CASE
                WHEN (' ' || lower(ra.alias) || ' ') LIKE '% ' || (SELECT syn_text FROM synonyms) || ' %'
                  OR (' ' || (SELECT syn_text FROM synonyms) || ' ') LIKE '% ' || lower(ra.alias) || ' %'
                THEN 1.0::numeric
                ELSE 0.0::numeric
              END,
              (
                SELECT COUNT(*)::numeric / (SELECT cnt FROM token_count)
                FROM input_tokens it
                WHERE (' ' || lower(ra.alias) || ' ') LIKE '% ' || it.token || ' %'
              )
            )
          )
        ),
        0.0::numeric
      ) AS score_part
    FROM base_roles br
    LEFT JOIN role_aliases ra ON ra.role_id = br.id
    GROUP BY br.id
  ),
  req_skill_score AS (
    SELECT
      br.id,
      COALESCE(
        CASE
          WHEN COUNT(*) FILTER (WHERE rs.importance = 'required') = 0 THEN 0.0::numeric
          ELSE (
            COUNT(*) FILTER (
              WHERE rs.importance = 'required'
                AND rs.skill_id IN (SELECT id FROM extracted_skill_ids)
            )::numeric
            / COUNT(*) FILTER (WHERE rs.importance = 'required')::numeric
          )
        END,
        0.0::numeric
      ) AS score_part
    FROM base_roles br
    LEFT JOIN role_skills rs ON rs.role_id = br.id
    GROUP BY br.id
  ),
  gth_skill_score AS (
    SELECT
      br.id,
      COALESCE(
        CASE
          WHEN COUNT(*) FILTER (WHERE rs.importance = 'good_to_have') = 0 THEN 0.0::numeric
          ELSE (
            COUNT(*) FILTER (
              WHERE rs.importance = 'good_to_have'
                AND rs.skill_id IN (SELECT id FROM extracted_skill_ids)
            )::numeric
            / COUNT(*) FILTER (WHERE rs.importance = 'good_to_have')::numeric
          )
        END,
        0.0::numeric
      ) AS score_part
    FROM base_roles br
    LEFT JOIN role_skills rs ON rs.role_id = br.id
    GROUP BY br.id
  ),
  scored AS (
    SELECT
      br.id,
      br.canonical_title,
      br.hint,
      (COALESCE(ts.score_part, 0) * 0.4)
      + (COALESCE(as1.score_part, 0) * 0.3)
      + (COALESCE(rs1.score_part, 0) * 0.2)
      + (COALESCE(gs1.score_part, 0) * 0.1) AS total_score
    FROM base_roles br
    LEFT JOIN title_score ts ON ts.id = br.id
    LEFT JOIN alias_score as1 ON as1.id = br.id
    LEFT JOIN req_skill_score rs1 ON rs1.id = br.id
    LEFT JOIN gth_skill_score gs1 ON gs1.id = br.id
  ),
  ranked AS (
    SELECT *
    FROM scored
    WHERE total_score > 0
    ORDER BY total_score DESC, canonical_title ASC
    LIMIT 10
  ),
  chosen_level AS (
    SELECT DISTINCT ON (r.id)
      r.id AS role_id,
      rsb.level_code,
      rsb.min_exp,
      rsb.max_exp
    FROM ranked r
    JOIN role_search_base rsb ON rsb.id = r.id
    CROSS JOIN synonyms s
    ORDER BY
      r.id,
      CASE WHEN s.lvl_filter IS NOT NULL AND rsb.level_code = s.lvl_filter THEN 0 ELSE 1 END,
      CASE rsb.level_code
        WHEN 'L2' THEN 0
        WHEN 'L1' THEN 1
        WHEN 'L3' THEN 2
        WHEN 'L4' THEN 3
        ELSE 4
      END,
      rsb.min_exp NULLS LAST
  ),
  salary_pick AS (
    SELECT
      cl.role_id,
      cb.percentile_25,
      cb.percentile_75
    FROM chosen_level cl
    LEFT JOIN LATERAL (
      SELECT b.percentile_25, b.percentile_75
      FROM compensation_benchmarks_v2 b
      WHERE b.aggregation_key = cl.role_id::text || '_' || cl.level_code
         OR b.aggregation_key = cl.role_id::text
      ORDER BY CASE WHEN b.aggregation_key = cl.role_id::text || '_' || cl.level_code THEN 0 ELSE 1 END
      LIMIT 1
    ) cb ON TRUE
  ),
  response_rows AS (
    SELECT
      r.total_score,
      r.canonical_title AS role,
      CASE
        WHEN cl.min_exp IS NOT NULL AND cl.max_exp IS NOT NULL
          THEN cl.min_exp::text || '–' || cl.max_exp::text || ' yrs'
        ELSE ''
      END AS experience_range,
      CASE
        WHEN sp.percentile_25 IS NOT NULL AND sp.percentile_75 IS NOT NULL
          THEN '₹' || ROUND(sp.percentile_25 / 100000.0)::int::text || '–' || ROUND(sp.percentile_75 / 100000.0)::int::text || 'L'
        ELSE ''
      END AS salary_inr,
      CASE
        WHEN sp.percentile_25 IS NOT NULL AND sp.percentile_75 IS NOT NULL
          THEN '$' || ROUND((sp.percentile_25 / 83.0) / 1000.0)::int::text || 'k–' || ROUND((sp.percentile_75 / 83.0) / 1000.0)::int::text || 'k'
        ELSE ''
      END AS salary_usd,
      COALESCE(
        (
          SELECT jsonb_agg(x.skill ORDER BY x.skill)
          FROM (
            SELECT DISTINCT btrim(sv.canonical_name) AS skill
            FROM role_skills rs
            JOIN skills_v2 sv ON sv.id = rs.skill_id
            WHERE rs.role_id = r.id
              AND rs.importance = 'required'
              AND btrim(sv.canonical_name) <> ''
          ) x
        ),
        '[]'::jsonb
      ) AS required_skills,
      COALESCE(
        (
          SELECT jsonb_agg(x.skill ORDER BY x.skill)
          FROM (
            SELECT DISTINCT btrim(sv.canonical_name) AS skill
            FROM role_skills rs
            JOIN skills_v2 sv ON sv.id = rs.skill_id
            WHERE rs.role_id = r.id
              AND rs.importance = 'good_to_have'
              AND btrim(sv.canonical_name) <> ''
          ) x
        ),
        '[]'::jsonb
      ) AS good_to_have,
      COALESCE(
        (
          SELECT jsonb_agg(x.alias ORDER BY x.alias)
          FROM (
            SELECT DISTINCT btrim(ra.alias) AS alias
            FROM role_aliases ra
            WHERE ra.role_id = r.id
              AND btrim(ra.alias) <> ''
          ) x
        ),
        '[]'::jsonb
      ) AS aliases,
      COALESCE(r.hint, '') AS hint
    FROM ranked r
    LEFT JOIN chosen_level cl ON cl.role_id = r.id
    LEFT JOIN salary_pick sp ON sp.role_id = r.id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'role', rr.role,
        'experience_range', rr.experience_range,
        'salary_inr', rr.salary_inr,
        'salary_usd', rr.salary_usd,
        'required_skills', rr.required_skills,
        'good_to_have', rr.good_to_have,
        'aliases', rr.aliases,
        'hint', rr.hint
      )
      ORDER BY rr.total_score DESC, rr.role ASC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM response_rows rr;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.search_roles(text) IS
  'Deterministic role search using role_search_base + token overlap scoring (title/alias/required/good-to-have) with fixed UI response shape.';

GRANT EXECUTE ON FUNCTION public.search_roles(text) TO anon;
GRANT EXECUTE ON FUNCTION public.search_roles(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_roles(text) TO service_role;
