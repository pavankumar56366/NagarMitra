# NagarMitra — Database Schema

Postgres on Lovable Cloud. All tables live in `public`, have RLS enabled and
explicit `GRANT`s. Role checks always go through security-definer functions.

## Enum types

| Type | Values |
|---|---|
| `app_role` | `commissioner`, `zonal_officer`, `citizen`, `worker` |
| `complaint_priority` | `critical`, `high`, `medium`, `low` |
| `complaint_status` | `pending`, `assigned`, `in_progress`, `resolved`, `verified`, `closed`, `escalated`, `reopened`, `cancelled` |
| `waste_category` | `organic`, `plastic`, `paper_cardboard`, `e_waste`, `construction_debris`, `hazardous`, `mixed` |

## Identity & org

### `profiles`
`id` (= auth user), `email`, `full_name`, `zone_id` → `zones`, `avatar_url`, `created_at`.
Own row readable/updatable; staff may read within scope.

### `user_roles`
`id`, `user_id`, `role app_role`, unique `(user_id, role)`.
Read-only from the app; written by `handle_new_user()` / admin SQL.

### `zones` (wards)
`id`, `ward_number`, `name`, `ward_member_name`, `supervisor_name`,
`locations` (covered areas text), `sensitivity_tags[]`, `center_lat`, `center_lng`, `created_at`.
50 Ongole wards seeded. Readable by authenticated users.

### `workers`
`id`, `name`, `phone`, `zone_id`, `user_id` (auth link, unique),
`availability` (`on_duty`/`off_duty`), `performance_score`, `created_at`.
Worker reads/updates own row; staff read within zone.

## Complaints

### `complaints`
Core: `id`, `reference`, `citizen_id`, `citizen_name`, `citizen_note`, `description`.
Location: `zone_id`, `lat`, `lng`, `address`, `location_name`.
Classification: `waste_category`, `priority`, `priority_override_reason`, `severity`, `waste_amount`.
AI / quality: `ai_label`, `ai_confidence`, `issue_detected`, `report_quality` (jsonb),
`report_quality_score`, `report_validation_status`, `validation_reason`.
Duplicates: `duplicate_status`, `duplicate_of_complaint_id` (self FK),
`duplicate_confidence`, `duplicate_detection_reason`, `image_hash`.
Workflow: `status`, `assigned_worker_id`, `assigned_worker_user_id`,
`escalation_level`, `verification_status`.
Timing: `reported_at`, `created_at`, `captured_at`, `accepted_at`, `sla_start`,
`sla_deadline`, `resolved_at`.
Soft delete: `deleted_at`, `deleted_by`, `deletion_reason`.
Media: `photo_url` (private bucket path).

Access: resident sees own rows; worker sees rows assigned to them;
ward officer sees own zone via `can_view_zone(zone_id)`; commissioner sees all.
No `DELETE` policy — removal is soft.

Triggers: `complaints_match_zone` (BEFORE INSERT → nearest ward),
`complaints_sync_worker_user` (BEFORE INSERT/UPDATE → keep `assigned_worker_user_id` in sync).

### `complaint_events`
`id`, `complaint_id`, `actor` (`citizen`/`worker`/`staff`/`system`), `event_type`,
`detail`, `created_at`. Append-only timeline; no UPDATE/DELETE.

### `complaint_supports`
"Me too" on an existing report: `id`, `complaint_id`, `citizen_id`, `note`, `lat`, `lng`, `created_at`.

### `completion_evidence`
`id`, `complaint_id`, `worker_id`, `worker_user_id`, `image_path`,
`latitude`, `longitude`, `location_name`, `captured_at`, `gps_verified`,
`distance_from_reported_location`, `completion_validation_status`,
`validation_reason`, `created_at`, `updated_at`.
Inserted only by the protected completion server function.

### `citizen_verifications`
`id`, `complaint_id`, `citizen_id`, `result` (`confirmed`/`rejected`), `comment`, `verified_at`.

### `escalations`
`id`, `complaint_id`, `from_level`, `to_level`, `reason`, `escalated_at`.

### `sla_config`
`priority` (PK), `duration_hours`, `warn_at_percent[]`, `escalation_extension_hours`, `updated_at`.

## Segregation guide

- `waste_categories` — `key waste_category`, `name`, `description`, `default_priority`, `is_active`.
- `segregation_rules` — per category: `waste_stream`, `bin_label`, `bin_color`,
  `disposal_guidance`, `warning_text`, `is_active`.
- `segregation_sessions` — `citizen_id`, `image_url`, `status`, `analyzed_at`.
- `segregation_results` — per detection: `label`, `confidence`, `bounding_box_json`,
  recommended stream/bin/colour, guidance, warning, plus `predicted_category`,
  `feedback`, `corrected_category`, `feedback_at`.

## Functions

| Function | Purpose |
|---|---|
| `has_role(uuid, app_role)` | role check (security definer, non-recursive) |
| `is_staff()` | commissioner or zonal officer |
| `current_zone()` | caller's ward from `profiles` |
| `current_worker_id()` | caller's worker row |
| `can_view_zone(uuid)` | commissioner, or officer of that ward |
| `handle_new_user()` | trigger on `auth.users`: profile + role + worker row |
| `match_zone()` | trigger: nearest ward for a new complaint |
| `sync_complaint_worker_user()` | trigger: keep worker auth id in sync |
| `backfill_worker_assignments()` | trigger: propagate worker `user_id` changes |
| `citizen_verify(uuid, boolean, text)` | confirm → `closed`; reject → `reopened` + 6h deadline |
| `run_sla_escalation()` | escalate overdue reports, extend deadline, log |

## Storage

| Bucket | Public | Contents |
|---|---|---|
| `complaint-photos` | No | report photos + completion evidence |
| `avatars` | No | profile pictures |

Both are read through short-lived signed URLs, scoped by owner/role policies.
