# Branching workflow

| Branch | Purpose |
|---|---|
| `main` | Stable, always deployable |
| `dev` | Integration branch — feature branches merge here first |
| `test` | QA/staging snapshot cut from `dev` |
| `feat/<name>` | One branch per feature, merged into `dev` when done |

```
feat/<name> ──► dev ──► test ──► main
```

← [Back to README](../README.md)
