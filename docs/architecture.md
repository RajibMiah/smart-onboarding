# Architecture

- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS) — `/frontend`
- **Backend:** Django REST Framework — `/backend`
- **Database:** MySQL

All three run as one Docker Compose stack (see [Setup](setup.md)), or natively
side-by-side for hot-reload during development.

Phase 1 wired the three together with a health-check endpoint. Since then the
frontend has grown a full dashboard, a browser-only video studio (recording +
timeline editing via ffmpeg.wasm), a media library, and account settings —
all under one editorial (black/white/yellow, sharp-bordered) design system.

## Project layout

```
smart-onboarding/
├── docker-compose.yml      # mysql + backend + frontend, networked together
├── .env.example             # docker compose config template (see docs/configuration.md)
├── docs/                   # this documentation, plus docs/screenshots/
├── backend/                # Django REST Framework
│   ├── Dockerfile
│   ├── docker-entrypoint.sh # runs migrations, then starts gunicorn
│   ├── config/              # project settings, urls, wsgi
│   ├── core/                 # health-check app
│   ├── manage.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/                # Next.js App Router
    ├── Dockerfile            # multi-stage: deps → builder → runner (standalone output)
    ├── app/                   # routes — see docs/pages.md
    ├── components/            # navigation, dashboard, library, editor, ui primitives
    ├── context/               # EditorContext (studio), ui-context (shell)
    ├── hooks/                 # recording, ffmpeg, filtering, forms, etc.
    ├── lib/                   # types, mock data, formatting helpers
    └── .env.local.example
```

← [Back to README](../README.md)
