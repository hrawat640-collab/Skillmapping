# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

This repo has two parallel deliverables. See `context.md` for full details.

| Service | Directory | Port | Run command |
|---------|-----------|------|-------------|
| **Backend (Express API)** | `backend/` | 5001 | `npm run dev` |
| **Static SPA (primary UI)** | repo root | 5500 | `npx serve . -l 5500` |
| **Python service (FastAPI)** | `python-service/` | 8000 | `source .venv/bin/activate && uvicorn app:app --reload --port 8000` |
| **Frontend (React/Vite)** | `frontend/` | 5173 | `npm run dev` |

### Service startup notes

- **Backend** must start first — the SPA and React frontend depend on it for API calls.
- The SPA auto-detects localhost and points `API_BASE_URL` to `http://localhost:5001`. No config change needed for local dev.
- The backend CORS allowlist includes `http://localhost:5500` and `http://127.0.0.1:5500` by default, which matches the static SPA server.
- The Python service downloads the sentence-transformers model on first start (~90 MB). Subsequent starts reuse the cached model.
- The Python service requires a venv at `python-service/.venv`. Activate it before running uvicorn.
- The backend `.env` is already populated with Supabase credentials (remote hosted DB — no local DB setup needed).
- The React frontend (`frontend/`) and Python service (`python-service/`) are optional — only needed for the CV evaluation flow.

### Gotchas

- `npx serve` will prompt for install confirmation the first time. Use `npx -y serve . -l 5500` to skip the prompt in automation.
- The backend uses ES modules (`"type": "module"` in `package.json`). All imports use `.js` extensions.
- There are no automated test suites (no test scripts in any `package.json`). Validation is via manual testing and the health endpoint (`GET /api/health`).
- `backend/src/seed.js` is deprecated/noop — do not rely on it.
- Frontend Vite dev server runs on port 5173 by default but is not in the backend CORS allowlist — add `FRONTEND_ORIGIN=http://localhost:5173` to `backend/.env` if you need the React frontend to call the backend.
