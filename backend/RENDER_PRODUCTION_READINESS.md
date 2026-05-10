# Render Production Readiness (semantic_baseline_v1)

Semantic scope is frozen at `semantic_baseline_v1`. This document covers deployment and runtime hardening only.

## 1) Service Configuration

- Runtime: Node.js (match local major version used for validation).
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/health`

## 2) Required Environment Variables

- `PORT` (Render injects this automatically)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (preferred) or `SUPABASE_ANON_KEY`
- `JWT_SECRET`
- `PYTHON_SERVICE_URL` (if evaluate path requires it)
- `FRONTEND_ORIGIN` (Netlify or primary frontend origin)
- `NETLIFY_ORIGIN` (if multiple frontend origins are used)
- `NODE_ENV=production`
- Optional: `SEARCH_TIMEOUT_MS` (default `12000`)

## 3) CORS Expectations

- Allowed:
  - `http://localhost:5500`
  - `http://127.0.0.1:5500`
  - `FRONTEND_ORIGIN`
  - `NETLIFY_ORIGIN`
- Blocked origins return:
  - HTTP `403`
  - `{ code: "CORS_ORIGIN_BLOCKED" }`

## 4) Runtime Safety Behavior

- Invalid config on boot exits fast with structured error log (`runtime_config_invalid`).
- Request timeout protection on orchestrated search:
  - HTTP `504`
  - `{ code: "WORKFLOW_SEARCH_TIMEOUT" }`
- Invalid request payloads return HTTP `400` with explicit error codes.

## 5) API Smoke Commands

Run after deploy:

```bash
curl -sS "$BACKEND_URL/api/health"
curl -sS -X POST "$BACKEND_URL/api/search-roles-orchestrated" -H "Content-Type: application/json" -d '{"workflow_type":"title","input_text":"Backend Engineer","limit_count":3}'
curl -sS -X POST "$BACKEND_URL/api/search-roles-orchestrated" -H "Content-Type: application/json" -d '{"workflow_type":"structured","input_text":"Python Kafka","skills":["Python","Kafka"],"limit_count":3}'
curl -sS -X POST "$BACKEND_URL/api/search-roles-orchestrated" -H "Content-Type: application/json" -d '{"workflow_type":"intent","input_text":"someone who creates and connects APIs","limit_count":3}'
```

## 6) Observability Events to Monitor

- `backend_started`
- `http_request`
- `search_zero_results`
- `search_request_failed`
- `cors_blocked`
- `runtime_config_invalid`
- `unhandled_rejection`
- `uncaught_exception`

## 7) Release Gates

- Health endpoint returns 200.
- All three workflows return deterministic arrays (no crash/500).
- Invalid payloads return 400 with correct codes.
- No `_rank_debug`, `_intent_rank_debug`, `semantic_terms`, or `why_matched` in public responses.
- CORS blocked origin returns 403.

