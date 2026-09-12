# Pages

Route map for the app. Screenshots for these pages live in the root
[README](../README.md#screenshots) — not duplicated here.

```
app/
├── (dashboard)/                     shared shell: top nav + sidebar + upload modal + support bubble
│   ├── page.tsx ..................  Dashboard home — quick actions, continue editing, projects rail
│   ├── dashboard/page.tsx ........  Analytics (placeholder)
│   ├── library/
│   │   ├── clips/page.tsx ........  Library — Clips (filter, sort, search, card grid)
│   │   ├── pages/page.tsx ........  Library — Pages (filter, sort, search, card grid)
│   │   └── playlists/page.tsx ....  Library — Playlists (placeholder)
│   ├── projects/page.tsx .........  Projects (placeholder)
│   ├── requests/page.tsx .........  Requests (placeholder)
│   ├── shared/page.tsx ...........  Shared with me (placeholder)
│   └── settings/account/page.tsx    Account Settings — profile form, avatar upload, accordions
├── studio/page.tsx ...............  Video Studio — screen/camera recording, timeline editor
└── health/page.tsx ...............  Health Check — live frontend → backend → MySQL status
```

"Placeholder" pages render a real empty state but have no feature behind them
yet — they're wired into navigation ahead of being built out.

← [Back to README](../README.md)
