# NagarMitra

AI-assisted municipal waste management platform. One web app serves three audiences:
residents who report waste, field workers who clear it, and municipal authorities who
monitor SLAs and performance.

## Main features

**Residents (`/app`)**
- Camera-based waste reporting with GPS location and automatic ward matching
- AI waste segregation helper: photograph an item, get its category and bin colour
  (green wet, blue dry, red hazardous/e-waste, grey debris) with a "not sure" fallback
- Feedback capture on segregation results ("Was this right?")
- Report list, report detail with timeline and resolution verification
- Profile with avatar upload

**Field workers (`/staff`)**
- Sign-in with ward-issued credentials (no self sign-up)
- Shift board with duty status (on duty / break / off duty)
- Assigned-only job queue with SLA/priority ordering, search and filters
- Job detail: navigate, view report photo, start clearing, add notes, mark cleared
- Worker profile with workload and rating

**Authority dashboard (`/overview` and related routes)**
- KPI overview, complaints list and detail, ward/zone breakdown
- Map view of complaints (Leaflet)
- Worker management, including creating worker accounts
- Escalations, reports with CSV export, settings

## Technology stack

- TanStack Start v1 (React 19, file-based routing) + Vite 8
- TypeScript
- Tailwind CSS v4 (configured through `src/styles.css`)
- shadcn/ui + Radix primitives, lucide icons, sonner toasts
- TanStack Query for data fetching
- Supabase (Lovable Cloud) for auth, Postgres with RLS, and storage
- Leaflet / react-leaflet for maps
- Capacitor config for an optional Android wrapper

## Project structure

```
src/
  routes/                  file-based routes
    __root.tsx             root shell, head metadata
    index.tsx              landing / role redirect
    auth.tsx               resident vs field-worker sign-in chooser
    app.*.tsx              resident mobile app
    staff.*.tsx            field worker app
    _authenticated/        authority dashboard (role-gated)
    api/                   server routes (if present)
  components/              shared UI (app shell, map, camera, avatar upload, ...)
  components/ui/           shadcn primitives
  hooks/                   React hooks
  lib/                     queries, waste rules, server functions (*.functions.ts)
  integrations/supabase/   generated client, admin client, auth middleware
  styles.css               Tailwind theme and design tokens
public/                    icons, manifest, robots.txt
supabase/                  local Supabase config
capacitor.config.ts        Android wrapper configuration
ANDROID-APK.md             guide for building the Android APK locally
```

## Installation

```sh
bun install     # or: npm install
```

## Environment variables

Copy `.env.example` to `.env` and fill in your Lovable Cloud / Supabase values:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL (browser) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable anon key (browser) |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ref |
| `SUPABASE_URL` | Same URL for server functions |
| `SUPABASE_PUBLISHABLE_KEY` | Same publishable key for server functions |
| `SUPABASE_PROJECT_ID` | Same project ref for server functions |

Server-only values (`SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`) are injected by the
hosting environment and must never be committed. The AI segregation feature requires
`LOVABLE_API_KEY` (Lovable AI Gateway) to be configured on the server.

## Development

```sh
bun dev          # start the dev server (http://localhost:8080)
bun run lint     # eslint
bun run format   # prettier
```

## Build

```sh
bun run build    # production build
bun run preview  # preview the production build
```

## Android APK

See `ANDROID-APK.md` for the Capacitor steps (`cap add android`, `cap sync`,
then build in Android Studio). The APK must be built locally; it is not produced by
this repository's build.

## Roles and access

Roles live in a dedicated `user_roles` table: `commissioner`, `zonal_officer`, `worker`,
`citizen`. After sign-in the app routes staff to the dashboard, workers to the field app,
and everyone else to the resident app. Row Level Security restricts every table by role
and ownership.
