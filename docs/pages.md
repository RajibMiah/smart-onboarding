# Pages

One screenshot per route, one link per screenshot — nothing bundled together.
Screenshots themselves live in the [Screenshots](../README.md#screenshots)
section of the root README; this file is the route → screenshot map.

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

"Placeholder" pages render a real empty state but have no feature behind them
yet — they're wired into navigation ahead of being built out.

← [Back to README](../README.md)
