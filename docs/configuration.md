# Configuration

| File | Used by | Purpose |
|---|---|---|
| `.env` (repo root) | `docker compose` | MySQL credentials, Django settings, `NEXT_PUBLIC_API_URL` — everything the three containers need |
| `backend/.env` | Native `python manage.py runserver` | Same settings, for running the backend outside Docker |
| `frontend/.env.local` | Native `npm run dev` | `NEXT_PUBLIC_API_URL`, for running the frontend outside Docker |

All three are git-ignored; each has a committed `.env.example` /
`.env.local.example` template with working local defaults:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

No real secrets live in any committed file — the defaults are dev-only
placeholders. Change `SECRET_KEY` and the MySQL passwords before this ever
runs anywhere but a local machine.

**Docker-specific note:** `NEXT_PUBLIC_API_URL` is baked into the frontend's
client bundle at *build* time (see `frontend/Dockerfile`), so editing it in
`.env` requires `docker compose up --build` (not just `restart`) to take
effect. It points at `http://localhost:8000` — the backend's host-published
port — because that's what the browser (running on your machine, not inside
Docker) needs to reach; the `DB_HOST=mysql` value, by contrast, is a
container-to-container hostname and only resolves inside the Compose network.

← [Back to README](../README.md)
