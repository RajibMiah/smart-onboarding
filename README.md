# Smart Onboarding — AI Paper Click (APC)

AI-powered onboarding video tutorial & documentation platform.

## Screenshots

One screenshot per page — see the [Pages](#pages) section below for how each
maps to a route in the code.

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

### Library — Clips
![Library — Clips](docs/screenshots/library-clips.png)

### Library — Pages
![Library — Pages](docs/screenshots/library-pages.png)

### Video Studio
![Video Studio](docs/screenshots/studio.png)

### Account Settings
![Account Settings](docs/screenshots/settings-account.png)

### Health Check
![Health Check](docs/screenshots/health.png)

<details>
<summary>Placeholder pages (empty state only, no feature built yet)</summary>

### Analytics
![Analytics](docs/screenshots/analytics-dashboard.png)

### Library — Playlists
![Library — Playlists](docs/screenshots/library-playlists.png)

### Projects
![Projects](docs/screenshots/projects.png)

### Requests
![Requests](docs/screenshots/requests.png)

### Shared with me
![Shared with me](docs/screenshots/shared.png)

</details>

## Architecture

- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS) — `/frontend`
- **Backend:** Django REST Framework — `/backend`
- **Database:** MySQL (via Docker Compose)

Phase 1 wired the three together with a health-check endpoint. Since then the
frontend has grown a full dashboard, a browser-only video studio (recording +
timeline editing via ffmpeg.wasm), a media library, and account settings —
all under one editorial (black/white/yellow, sharp-bordered) design system.

## Project Layout

```
smart-onboarding/
├── docker-compose.yml      # MySQL service
├── docs/screenshots/       # one screenshot per page — see "Pages" below
├── backend/                # Django REST Framework
│   ├── config/              # project settings, urls, wsgi
│   ├── core/                 # health-check app
│   ├── manage.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/                # Next.js App Router
    ├── app/                   # routes — see "Pages" below
    ├── components/            # navigation, dashboard, library, editor, ui primitives
    ├── context/               # EditorContext (studio), ui-context (shell)
    ├── hooks/                 # recording, ffmpeg, filtering, forms, etc.
    ├── lib/                   # types, mock data, formatting helpers
    └── .env.local.example
```

## Pages

One screenshot per route, one link per screenshot — nothing bundled together.

```
app/
├── (dashboard)/                     shared shell: top nav + sidebar + upload modal + support bubble
│   ├── page.tsx ..................  Dashboard home — quick actions, continue editing, projects rail
│   │                                → docs/screenshots/dashboard.png
│   ├── dashboard/page.tsx ........  Analytics (placeholder)
│   │                                → docs/screenshots/analytics-dashboard.png
│   ├── library/
│   │   ├── clips/page.tsx ........  Library — Clips (filter, sort, search, card grid)
│   │   │                            → docs/screenshots/library-clips.png
│   │   ├── pages/page.tsx ........  Library — Pages (filter, sort, search, card grid)
│   │   │                            → docs/screenshots/library-pages.png
│   │   └── playlists/page.tsx ....  Library — Playlists (placeholder)
│   │                                → docs/screenshots/library-playlists.png
│   ├── projects/page.tsx .........  Projects (placeholder)
│   │                                → docs/screenshots/projects.png
│   ├── requests/page.tsx .........  Requests (placeholder)
│   │                                → docs/screenshots/requests.png
│   ├── shared/page.tsx ...........  Shared with me (placeholder)
│   │                                → docs/screenshots/shared.png
│   └── settings/account/page.tsx    Account Settings — profile form, avatar upload, accordions
│                                    → docs/screenshots/settings-account.png
├── studio/page.tsx ...............  Video Studio — screen/camera recording, timeline editor
│                                    → docs/screenshots/studio.png
└── health/page.tsx ...............  Health Check — live frontend → backend → MySQL status
                                     → docs/screenshots/health.png
```

Screenshots for every route above are in the [Screenshots](#screenshots)
section at the top of this file. "Placeholder" pages render a real empty
state but have no feature behind them yet — they're wired into navigation
ahead of being built out.

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

## Configuration

- `backend/.env` — Django secret key, debug flag, MySQL credentials, CORS allowed origins.
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL` pointing at the Django backend.

Both `.env` / `.env.local` files are git-ignored; `.env.example` / `.env.local.example`
are committed as templates.

## Branching workflow

- `main` — stable, always deployable.
- `dev` — integration branch; feature branches merge here first.
- `test` — QA/staging snapshot cut from `dev`.
- `feat/<name>` — one branch per feature, merged into `dev` when done.

```
feat/<name> ──► dev ──► test ──► main
```
