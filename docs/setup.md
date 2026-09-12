# Setup

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
- Frontend: open http://localhost:3000 — the dashboard loads, and `/health`
  shows the same backend connectivity check in the browser.

## Everyday commands

| Action | Command |
|---|---|
| Start MySQL | `docker compose up -d mysql` |
| Stop MySQL | `docker compose stop mysql` |
| Run migrations | `cd backend && source venv/bin/activate && python manage.py migrate` |
| New migration | `cd backend && source venv/bin/activate && python manage.py makemigrations` |
| Run backend | `cd backend && source venv/bin/activate && python manage.py runserver 8000` |
| Run frontend | `cd frontend && npm run dev` |

← [Back to README](../README.md)
