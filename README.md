# CV Evaluation SaaS (100% Free Stack)

## Active App Target

- Production frontend target is the root `index.html` (single-file app).
- Netlify should build from repo root `netlify.toml` and publish `.`.
- `frontend` (React + Vite) is optional/secondary and not the primary app path.

Production-style SaaS scaffold with:

- `frontend` (React + Tailwind + Recharts)
- `backend` (Node.js + Express + JWT + Multer + MongoDB)
- `python-service` (FastAPI + pdfplumber/PyMuPDF + NLP scoring)

## Features Implemented

- JWT auth (`/api/auth/register`, `/api/auth/login`)
- CV evaluation endpoint (`/api/evaluate`)
- PDF upload only (Multer)
- Role keyword DB query (`mustHave`, `niceToHave`)
- Free JD generation in backend (no paid API keys required)
- NLP processing service:
  - PDF text extraction
  - keyword match %
  - semantic similarity
  - experience fit
  - designation similarity
  - per-JD scoring
- Dashboard UI:
  - overall score badge
  - progress bars
  - matched/missing keyword chips
  - JD score chart
  - Rule-based improvement suggestions (free)
  - PDF export button

## Folder Structure

```text
frontend/
backend/
python-service/
```

## 1) Backend Setup

```bash
cd backend
npm install
cp .env.example .env
npm run seed
npm run dev
```

## 2) Python Service Setup

```bash
cd python-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

## 3) Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Environment Variables

### backend/.env

- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `PYTHON_SERVICE_URL`

### frontend/.env

- `VITE_API_URL`

## Deployment Notes

- Frontend: Netlify (`frontend/netlify.toml`) or Vercel static build
- Backend: Vercel (`backend/vercel.json`) or Render/Railway
- Python service: Render/Fly.io/EC2 (point backend `PYTHON_SERVICE_URL`)

## Cost

This setup is intentionally free-only:

- No paid LLM/API dependency
- No paid jobs API dependency
- Works on free tiers for Netlify/Vercel + free MongoDB/local DB + self-hosted/free Python service
