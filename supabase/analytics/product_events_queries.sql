-- Product analytics queries (search_logs replacement)
-- Source of truth: product_events

-- 1) Search volume and no-result rate by day.
SELECT
  date_trunc('day', created_at) AS day,
  COUNT(*) FILTER (WHERE event_name = 'search_performed') AS searches,
  COUNT(*) FILTER (WHERE event_name = 'no_result_search') AS no_result_searches,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE event_name = 'no_result_search')
    / NULLIF(COUNT(*) FILTER (WHERE event_name IN ('search_performed','no_result_search')), 0),
    2
  ) AS no_result_rate_pct
FROM product_events
WHERE event_name IN ('search_performed', 'no_result_search')
GROUP BY 1
ORDER BY 1 DESC;

-- 2) Top search queries (last 30 days).
SELECT
  lower(trim(search_query)) AS search_query,
  COUNT(*) AS search_count
FROM product_events
WHERE event_name IN ('search_performed', 'no_result_search')
  AND created_at >= now() - interval '30 days'
  AND COALESCE(trim(search_query), '') <> ''
GROUP BY 1
ORDER BY 2 DESC
LIMIT 100;

-- 3) Role card views by role (last 30 days).
SELECT
  COALESCE(role_id, metadata->>'role_title', 'unknown') AS role_ref,
  COUNT(*) AS views
FROM product_events
WHERE event_name = 'role_card_viewed'
  AND created_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 2 DESC
LIMIT 100;

-- 4) Conversion funnel: login -> onboarding -> salary submission.
WITH base AS (
  SELECT
    COALESCE(NULLIF(user_uuid,''), session_id) AS actor,
    event_name,
    created_at
  FROM product_events
  WHERE event_name IN ('login_completed', 'onboarding_completed', 'salary_submitted')
)
SELECT
  COUNT(DISTINCT actor) FILTER (WHERE event_name = 'login_completed') AS logins,
  COUNT(DISTINCT actor) FILTER (WHERE event_name = 'onboarding_completed') AS onboarded,
  COUNT(DISTINCT actor) FILTER (WHERE event_name = 'salary_submitted') AS salary_submitters
FROM base;

