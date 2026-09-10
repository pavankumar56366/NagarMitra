# NagarMitra — Technical Requirements Document

## 1. Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start v1 (React 19, SSR + server functions) |
| Build | Vite 7 |
| Routing | TanStack Router, file-based (`src/routes`) |
| Data fetching | TanStack Query |
| Styling | Tailwind CSS v4 via `src/styles.css` theme tokens + shadcn components |
| Backend | Lovable Cloud (Postgres, Auth, Storage) |
| Server runtime | Edge worker (Cloudflare workerd, `nodejs_compat`) |
| AI | Lovable AI Gateway (vision + classification) |
| Mobile shell | Capacitor (Android) |
| Maps | Leaflet, loaded client-only |

## 2. Module map

### Configuration & pure logic (client-safe)
- `src/lib/validation-config.ts` — all thresholds: genuineness confidence,
  duplicate confidence bands, GPS accuracy limit, completion radius (120 m),
  duplicate time window.
- `src/lib/geo.ts` — haversine distance, radius checks, duplicate proximity helpers.
- `src/lib/report-scoring.ts` — pure report-quality scoring from AI + GPS + metadata.
- `src/lib/waste.ts`, `src/lib/citizen.ts`, `src/lib/queries.ts` — domain types, query options.
- `src/lib/i18n.tsx` — language dictionaries, provider, `useI18n`, `nagarmitra.lang` persistence.

### Server-only services (`*.server.ts`, never client-imported)
- `src/lib/report-ai.server.ts` — vision prompt + parsing: genuineness, category,
  severity, waste amount, confidence.
- `src/lib/geocode.server.ts` — reverse geocoding to a human location name.
- `src/lib/report-crypto.server.ts` — perceptual image hash + signing.
- `src/lib/ai-gateway.server.ts` — AI Gateway client (`LOVABLE_API_KEY`, read inside handlers).

### Server functions (`*.functions.ts`, client-importable RPC)
- `report-validation.functions.ts` — analyse candidate photo, duplicate check, submit report, support existing report.
- `vision.functions.ts` — segregation classification.
- `worker-completion.functions.ts` — completion photo upload, GPS radius verification, resolve transition.
- `citizen-verification.functions.ts` — confirm / reject cleanup (wraps `citizen_verify`).
- `citizen-delete.functions.ts` — protected delete / cancel with ownership + status checks.
- `worker-accounts.functions.ts` — staff-side worker account management.

All protected functions use `.middleware([requireSupabaseAuth])`; `src/start.ts`
registers the client-side bearer-token `functionMiddleware`.

## 3. Route structure

```
/                        redirect by role
/auth                    persona picker + sign-in/sign-up + Google + language
/app                     resident shell (bottom nav)
  /app                   home
  /app/report            camera capture -> AI -> submit
  /app/reports           my reports (+ /:id detail, verify, delete/withdraw)
  /app/segregate         segregation guide
  /app/profile           profile, avatar, language
/staff                   worker shell (dashboard, reports, /:id, profile, duty toggle)
/_authenticated          staff shell, gate redirects non-staff
  overview, complaints (+ $id), map, zones, workers, escalations, reports, settings
```

Role gating happens in `beforeLoad` (`ssr: false` on gated routes) plus RLS in
the database. `src/routeTree.gen.ts` is generated — never edited.

## 4. Security model

- Roles in `public.user_roles` + `has_role()` / `is_staff()` / `can_view_zone()`
  security-definer functions; all RLS policies call these, never subquery roles inline.
- Every public table has explicit `GRANT`s alongside RLS.
- Storage buckets `complaint-photos` and `avatars` are private; access via signed URLs.
- Ward officers are scoped through `current_zone()`; workers through `current_worker_id()`.
- Service-role key and DB password are not exposed to the app or the user.
- Writes that decide workflow state (resolve, verify, delete) go through server
  functions, not client mutations.

## 5. Validation pipeline (submit)

```
capture photo (camera only)
   -> GPS fix (accuracy gate)
   -> reverse geocode
   -> AI genuineness/category/severity/amount + confidence
   -> quality score
   -> image hash
   -> duplicate scan (radius + category + hash distance + time window)
        high  -> block, offer support
        mid   -> insert with review status
        none  -> insert
   -> insert complaint + timeline event, zone matched by trigger
```

## 6. Completion pipeline (worker)

```
capture completion photo -> GPS fix
   -> distance(reported, current) <= COMPLETION_RADIUS_M ?
        no  -> reject, record reason, no state change
        yes -> upload to complaint-photos, insert completion_evidence,
               set status resolved, append timeline event
```

## 7. Automation

- `run_sla_escalation()` bumps overdue reports to `escalated`, extends the deadline
  per `sla_config`, and writes `escalations` + timeline rows. Invoked from a
  cron-authenticated public route (`src/routes/api/public/*`, secret-verified).
- `handle_new_user()` creates profile, role and (for workers) the worker row.

## 8. Non-functional requirements

- Mobile-first, 520 px resident shell; installable manifest; safe-area aware nav.
- Per-route `head()` metadata with unique titles/descriptions.
- No Node-only packages in server functions (edge runtime).
- Typecheck (`tsgo --noEmit`) and build must be clean before release.

## 9. Environment

- Server: `LOVABLE_API_KEY`, `LOVABLE_CRON_SECRET`, Cloud connection values (read inside handlers).
- Client: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (auto-generated `.env`).
