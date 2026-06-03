-- Smoke tests for public.search_roles(input_text text)
-- Run in Supabase SQL editor (or psql) after migrations.
-- The script intentionally raises exceptions when invariants fail.

DO $$
DECLARE
  payload jsonb;
  first_role text;
BEGIN
  -- 1) Basic contract: function returns an array.
  payload := public.search_roles('backend dev java microservices');
  IF jsonb_typeof(payload) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'search_roles must return a JSON array. Got: %', jsonb_typeof(payload);
  END IF;

  -- 2) If we have results, each object must contain required keys and types.
  IF jsonb_array_length(payload) > 0 THEN
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(payload) AS e
      WHERE jsonb_typeof(e) IS DISTINCT FROM 'object'
         OR NOT (e ? 'role')
         OR NOT (e ? 'experience_range')
         OR NOT (e ? 'salary_inr')
         OR NOT (e ? 'salary_usd')
         OR NOT (e ? 'required_skills')
         OR NOT (e ? 'good_to_have')
         OR NOT (e ? 'aliases')
         OR NOT (e ? 'hint')
         OR jsonb_typeof(e->'required_skills') IS DISTINCT FROM 'array'
         OR jsonb_typeof(e->'good_to_have') IS DISTINCT FROM 'array'
         OR jsonb_typeof(e->'aliases') IS DISTINCT FROM 'array'
    ) THEN
      RAISE EXCEPTION 'search_roles response shape/type mismatch';
    END IF;
  END IF;

  -- 3) Scenario check: backend-heavy query should surface backend roles early.
  first_role := COALESCE(payload->0->>'role', '');
  IF jsonb_array_length(payload) = 0 THEN
    RAISE NOTICE 'No results for backend scenario (data-dependent).';
  ELSIF first_role NOT ILIKE '%backend%' AND first_role NOT ILIKE '%engineer%' THEN
    RAISE NOTICE 'Top role for backend scenario is "%", verify ranking quality manually.', first_role;
  END IF;

  -- 4) Scenario check: synonym mapping "hr legal" should discover HRBP-like role.
  payload := public.search_roles('hr legal');
  IF jsonb_array_length(payload) = 0 THEN
    RAISE NOTICE 'No results for hr legal scenario (data-dependent).';
  ELSIF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(payload) AS e
    WHERE lower(e->>'role') LIKE '%hr business partner%'
       OR EXISTS (
         SELECT 1
         FROM jsonb_array_elements_text(e->'aliases') AS a(alias)
         WHERE lower(alias) LIKE '%hr business partner%'
       )
  ) THEN
    RAISE NOTICE 'hr legal scenario did not surface HR Business Partner; verify synonym data/aliases.';
  END IF;

  -- 5) Stability: unusual token input should not error and should return array.
  payload := public.search_roles('c++ developer');
  IF jsonb_typeof(payload) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'c++ query must still return array payload';
  END IF;

  -- 6) Guard against "java" accidentally matching only javascript-style roles.
  payload := public.search_roles('java');
  IF jsonb_array_length(payload) > 0 AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(payload) AS e
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(e->'required_skills') AS s(skill)
      WHERE lower(skill) = 'java'
    )
  ) THEN
    RAISE NOTICE 'java query returned results but none with required skill "java"; verify token overlap behavior.';
  END IF;
END $$;

