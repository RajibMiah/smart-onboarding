# Configuration

| File | Purpose |
|---|---|
| `backend/.env` | Django secret key, debug flag, MySQL credentials, CORS allowed origins |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL` pointing at the Django backend |

Both `.env` / `.env.local` files are git-ignored; `.env.example` /
`.env.local.example` are committed as templates. Copy the example, then edit
values as needed:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

← [Back to README](../README.md)
