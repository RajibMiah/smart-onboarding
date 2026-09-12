# Smart Onboarding

AI-powered onboarding video tutorial & documentation platform (Clypp-style).

## Architecture

- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS) — `/frontend`
- **Backend:** Django REST Framework — `/backend`
- **Database:** MySQL (via Docker Compose)

Phase 1 (this setup) wires the three together with a health-check endpoint.
Screen recording, FFmpeg processing, and AI pipelines layer on top in later phases.

## Project Layout

```
smart-onboarding/
├── docker-compose.yml      # MySQL service
├── backend/                # Django REST Framework
│   ├── config/              # project settings, urls, wsgi
│   ├── core/                 # health-check app
│   ├── manage.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/                # Next.js App Router
    ├── app/page.tsx           # fetches /api/health/ and shows status
    └── .env.local.example
```

## Prerequisites

- Python 3.11+ (tested on 3.14)
- Node.js 20+ (tested on 26)
- Docker Desktop (for MySQL) — or a local MySQL 8 instance

## First-time setup

```bash
# 1. Start MySQL
docker compose up -d mysql

# 2. Backend
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # defaults already match docker-compose.yml
python manage.py migrate
python manage.py runserver 8000

# 3. Frontend (new terminal)
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

## Verify

- Backend health check: `curl http://localhost:8000/api/health/`
  ```json
  {"status":"ok","database":{"status":"ok","vendor":"mysql","name":"smart_onboarding","error":null}}
  ```
- Frontend: open http://localhost:3000 — it fetches the health endpoint client-side and
  renders a green "Backend + database connected" card once both services are up.

## Everyday commands

| Action | Command |
|---|---|
| Start MySQL | `docker compose up -d mysql` |
| Stop MySQL | `docker compose stop mysql` |
| Run migrations | `cd backend && source venv/bin/activate && python manage.py migrate` |
| New migration | `cd backend && source venv/bin/activate && python manage.py makemigrations` |
| Run backend | `cd backend && source venv/bin/activate && python manage.py runserver 8000` |
| Run frontend | `cd frontend && npm run dev` |

## Configuration

- `backend/.env` — Django secret key, debug flag, MySQL credentials, CORS allowed origins.
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL` pointing at the Django backend.

Both `.env` / `.env.local` files are git-ignored; `.env.example` / `.env.local.example`
are committed as templates.
# smart-onboarding
