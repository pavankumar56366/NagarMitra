# NagarMitra

AI-assisted municipal waste management platform. One web app serves three audiences:
residents who report waste, field workers who clear it, and municipal authorities who
monitor SLAs and performance.

## Main features

**Residents (`/app`)**
- Camera-based waste reporting with GPS location and automatic ward matching
- AI waste segregation helper (`/app/segregate`): photograph household waste and get every
  item's category, bin colour and disposal guidance — see
  [Waste segregation assistant](#waste-segregation-assistant) below
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

## Waste segregation assistant

Route: **`/app/segregate`** — available to every signed-in resident. It turns a photo of
household waste into bin guidance, so residents segregate before disposal instead of guessing.

### How it works

1. The resident captures a photo of the waste in hand (camera capture, no file uploads).
2. The image is sent to the AI model (`google/gemini-3.8-flash`) through the Lovable AI
   Gateway by the `analyzeHouseholdWaste` server function.
3. The model returns up to 6 distinct items, most prominent first, each with a label, a
   category and an honest confidence score.
4. Each item is matched against the active rows of the `segregation_rules` table, which
   supply the bin colour chip, waste stream, disposal guidance and any safety warning.
5. The resident is asked "Was this right?" and, when they say no, which bin was actually
   correct — that answer is stored for later accuracy review.

### Categories and bins

| Category | Bin | Handling |
| --- | --- | --- |
| Organic | Green | Wet / compostable waste |
| Plastic | Blue | Dry recyclable |
| Paper / Cardboard | Blue | Dry recyclable |
| E-Waste | Red | Special drop-off |
| Hazardous / Medical | Red | Hazardous collection |
| Construction Debris | Grey | Special handling |
| Mixed / Unsegregated | — | Must be sorted before disposal |

### "Not sure" behaviour

Confidence below **55%** is never presented as an instruction. The card is marked unsure and
advises a closer, brighter photo or manual sorting using the guidance shown, so a bad guess
never sends hazardous or e-waste into the wrong bin. When more than one item is detected, the
resident is told to separate those items before disposal.

### Data captured

Every run writes one `segregation_sessions` row and one `segregation_results` row per item,
recording `label`, `confidence`, `predicted_category`, `recommended_stream`,
`recommended_bin_label`, `recommended_bin_color`, `disposal_guidance`, `warning_text`,
`waste_category_id`, plus `feedback`, `corrected_category` and `feedback_at`. Results are
visible only to their owner under Row Level Security.

Because the rules live in `segregation_rules`, municipal staff can change bin colours,
guidance text or warnings without a code change or redeploy.

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
