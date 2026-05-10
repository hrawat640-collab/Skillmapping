# Semantic Baseline V1 Productionization Checklist

This checklist freezes semantic scope at `semantic_baseline_v1` and shifts execution to deployment, stability, observability, and real-world validation.

## Freeze Guardrails

- Semantic scope frozen: retrieval vocabularies, family templates, archetypes, manifests, benchmark suite, inheritance contracts, scoring contracts.
- No ranking redesign, ontology expansion, or retrieval redesign without a benchmark-approved change request.
- Semantic iteration policy: slow, controlled, benchmark-driven only.

## Deployment Readiness

- Confirm backend deploy target configuration for Render (`backend/vercel.json` not used in Render path).
- Validate Node runtime version parity between local and Render.
- Ensure startup command is stable: `npm start` from `backend`.
- Validate environment variables present in Render service:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `JWT_SECRET`
  - `PYTHON_SERVICE_URL` (if required in production path)
  - `FRONTEND_ORIGIN` / `NETLIFY_ORIGIN` for CORS allowlist

## Runtime Stability Checks

- API health smoke: `/api/search-roles` responds for all 3 workflows (`structured`, `title`, `intent`).
- Canonical prompt smoke run succeeds with non-500 responses.
- Supabase connectivity check on startup path (no null admin client in production).
- CORS preflight (`OPTIONS`) confirms expected allowed origins and headers.

## Logging and Observability

- Keep structured debug payloads available server-side; do not expose internals on UI cards.
- Ensure production logs capture:
  - workflow route selection
  - candidate counts (raw/deduped/final)
  - intent prior activation and fallback usage
  - retrieval enrichment activation
  - shadow runtime execution status and errors
- Add alert threshold for repeated zero-candidate responses by prompt family.

## Failure Analytics Hooks

- Track per-query reliability fields in logs:
  - prompt family
  - baseline candidate count
  - top1 score/confidence
  - zero-result flag
  - elapsed response time
- Track top failure buckets:
  - no candidates
  - noisy top1 family mismatch
  - low-confidence collapse

## Production-Safe Error Handling

- Keep search logging non-blocking (`logSearchQuery` failures must not fail requests).
- Ensure fallback behavior returns deterministic empty result safely if Supabase RPC errors.
- Confirm all thrown errors are wrapped with safe messages for API responses.

## API Reliability Checks

- Validate p95 latency for canonical prompts remains within target SLO.
- Validate zero-candidate rate by workflow below agreed threshold.
- Validate top-family mismatch rate trend after deployment.
- Run `semantic:shadow:eval` snapshot before release and archive output.

## Recruiter Validation Track

- Run controlled UAT with recruiter prompts mapped to canonical families.
- Capture qualitative trust feedback:
  - role relevance
  - ownership alignment
  - confidence believability
- Record validation notes against `semantic_baseline_v1` snapshot artifacts.

