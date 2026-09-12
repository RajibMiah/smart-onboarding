# Configuration

| File | Used by | Purpose |
|---|---|---|
| `.env` (repo root) | `docker compose` | MySQL credentials, Django settings, `NEXT_PUBLIC_API_URL` — everything the three containers need |
| `backend/.env` | Native `python manage.py runserver` | Same settings, for running the backend outside Docker |
| `frontend/.env.local` | Native `npm run dev` | `NEXT_PUBLIC_API_URL`, for running the frontend outside Docker |

All three are git-ignored; each has a committed `.env.example` /
`.env.local.example` template listing every key with **no value filled
in** — deliberately, so nothing gets copy-pasted without a conscious choice.
Copy the template, then fill in every key:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

## Suggested local values

Anything works for local development as long as it's consistent across
files; these are just a sensible starting point. **Never reuse them anywhere
but a local machine** — pick a real, unique `SECRET_KEY` and MySQL passwords
for any shared or deployed environment.

| Key | Suggested local value | Used in |
|---|---|---|
| `MYSQL_DATABASE` / `DB_NAME` | `smart_onboarding` | root `.env`, `backend/.env` |
| `MYSQL_USER` / `DB_USER` | `onboarding_user` | root `.env`, `backend/.env` |
| `MYSQL_PASSWORD` / `DB_PASSWORD` | any string, matching in both places | root `.env`, `backend/.env` |
| `MYSQL_ROOT_PASSWORD` | any string | root `.env` only |
| `DEBUG` | `True` | root `.env`, `backend/.env` |
| `SECRET_KEY` | any long random string | root `.env`, `backend/.env` |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | root `.env`, `backend/.env` |
| `DB_HOST` | `mysql` in root `.env` (Docker network name) — `127.0.0.1` in `backend/.env` (native) | root `.env`, `backend/.env` |
| `DB_PORT` | `3306` | root `.env`, `backend/.env` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | root `.env`, `backend/.env` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | root `.env`, `frontend/.env.local` |

**Docker-specific note:** `NEXT_PUBLIC_API_URL` is baked into the frontend's
client bundle at *build* time (see `frontend/Dockerfile`), so editing it in
`.env` requires `docker compose up --build` (not just `restart`) to take
effect. It points at `http://localhost:8000` — the backend's host-published
port — because that's what the browser (running on your machine, not inside
Docker) needs to reach; `DB_HOST=mysql`, by contrast, is a
container-to-container hostname and only resolves inside the Compose network.

← [Back to README](../README.md)
