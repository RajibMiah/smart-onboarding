# Setup

## Prerequisites

- Docker Desktop (recommended — runs the whole stack)
- For native development instead: Python 3.11+ (tested on 3.14), Node.js 20+ (tested on 26)

## Option A: Docker (whole stack)

```bash
cp .env.example .env   # edit values if you want, defaults work as-is
docker compose up --build
```

This builds and runs all three services — MySQL, the Django backend, and the
Next.js frontend — networked together. First build takes a minute or two;
subsequent runs are fast. See [Architecture](architecture.md) for what each
Dockerfile does, and [Configuration](configuration.md) for what's in `.env`.

| Action | Command |
|---|---|
| Start everything | `docker compose up --build` |
| Start in the background | `docker compose up -d --build` |
| Stop everything | `docker compose down` |
| Stop but keep the MySQL volume | `docker compose stop` |
| Tail logs | `docker compose logs -f backend` (or `frontend`, `mysql`) |
| Rebuild one service | `docker compose up -d --build backend` |

## Option B: Native (for hot-reload while developing)

Docker rebuilds the frontend/backend images on every change, which is too
slow for active development. Run MySQL in Docker but the app servers
natively instead:

```bash
# 1. Start MySQL only
docker compose up -d mysql

# 2. Backend
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # backend/.env.example — defaults match docker-compose.yml
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
- Frontend: open http://localhost:3000 — the dashboard loads, and `/health`
  shows the same backend connectivity check in the browser.

## Everyday commands (native)

| Action | Command |
|---|---|
| Start MySQL | `docker compose up -d mysql` |
| Stop MySQL | `docker compose stop mysql` |
| Run migrations | `cd backend && source venv/bin/activate && python manage.py migrate` |
| New migration | `cd backend && source venv/bin/activate && python manage.py makemigrations` |
| Run backend | `cd backend && source venv/bin/activate && python manage.py runserver 8000` |
| Run frontend | `cd frontend && npm run dev` |

← [Back to README](../README.md)
