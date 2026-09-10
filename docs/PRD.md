# NagarMitra — Product Requirements Document (Version 2)

**Product:** NagarMitra — Smart Waste Management & Civic Complaint Platform
**City pilot:** Ongole Municipal Corporation (50 wards)
**Tagline:** Cleaner Today, Greener Tomorrow

---

## 1. Purpose

Residents photograph waste problems; AI validates the report; the ward office
assigns a field worker; the worker proves completion with a GPS-verified photo;
the resident confirms the cleanup. Every step is logged and time-bound.

## 2. Problem statement

- Complaints today arrive by phone/WhatsApp with no location proof and no audit trail.
- Fake, duplicate and low-quality reports waste field crew time.
- "Work done" claims cannot be verified, so the same spot is reported repeatedly.
- Ward officers have no live view of pending load, response time or escalations.

## 3. Goals

| Goal | Success measure |
|---|---|
| Trustworthy reports | AI rejects non-waste / fake images before they reach a crew |
| No duplicate dispatch | Near-identical reports are linked, not re-dispatched |
| Verifiable completion | 100% of resolutions carry a GPS-verified completion photo |
| Time-bound response | Every report has a response deadline and auto-escalates |
| Closed loop | Resident confirms or reopens after resolution |

Non-goals (V2): payments, private contractor billing, vehicle/route tracking,
offline-first sync, citizen-to-citizen chat.

## 4. Personas

1. **Resident (citizen)** — mobile-first, reports waste, tracks and verifies it.
2. **Field worker** — ward-issued login, sees assigned jobs, must capture a completion photo on site.
3. **Ward member (zonal officer)** — sees only their ward: complaints, workers, escalations.
4. **Chairperson (commissioner)** — city-wide overview, all wards, settings, reports.

## 5. Feature requirements

### 5.1 Report a problem (resident)
- **Camera-only capture.** No gallery or file picker. Preview + retake allowed.
- Device GPS is captured with the photo; coarse/failed fixes are rejected.
- Reverse-geocoded location name plus landmark/notes fields.
- AI genuineness check: is this really waste? category, severity, waste amount,
  confidence. Non-genuine images are rejected with a plain-language reason.
- Report-quality score shown to the resident before submit.
- Duplicate detection on location + category + image similarity + time window:
  - high confidence → blocked, offered as "support this existing report"
  - uncertain → submitted with `REVIEW` status for ward staff
  - unique → created normally
- Resident may **delete** a not-yet-actioned report, or **withdraw (cancel)** one
  already in progress. Ownership and status are enforced server-side; cancelled
  reports become read-only and retain deletion metadata.

### 5.2 My reports (resident)
- List with status, priority, ward, timestamps, photo.
- Detail view: timeline of events, validation facts, location facts, assigned worker,
  completion evidence photo when resolved.
- Verify cleanup: **Confirm** (closes report) or **Reject** (reopens with a 6-hour deadline).

### 5.3 Waste segregation guide (resident)
- Photograph an item, get bin/stream/colour recommendation, disposal guidance,
  warnings, and a correction/feedback option.

### 5.4 Field worker app
- Duty toggle (on duty / off duty).
- Assigned jobs list, job detail with location, category, severity, resident note.
- **Mandatory completion photo**: camera-only, GPS checked against the configured
  radius (default 120 m) of the reported location. Outside the radius → refused
  with the measured distance. Inside → job resolved and evidence stored privately.
- Profile with avatar.

### 5.5 Ward / chairperson console
- Overview KPIs, complaints list + filters, complaint detail with full timeline,
  map view, ward directory (member, covered areas), workers, escalations, reports, settings.
- Ward members are scoped to their own ward; chairperson sees all.

### 5.6 Platform
- Role-based sign-in (resident self sign-up; worker and staff accounts issued by the office).
- Google sign-in for residents.
- Language picker: English, Hindi, Telugu, Kannada, Tamil — remembered per device.
- Photos and avatars stored privately, served via short-lived links.
- Response-time (SLA) config per priority with automatic escalation.
- Installable web app + Android wrapper.

## 6. Key rules

- Roles live in a dedicated roles table; never on the profile.
- A worker cannot resolve a job without valid evidence.
- A resident can only act on their own reports.
- Reports are never hard-deleted once operational — they are cancelled and retained.
- All state changes append to an immutable event timeline.

## 7. Out of scope / known limits

- Ward map coordinates are approximate ward centres.
- Seeded demo reports have no photos, so completion still requires a real capture.
- Demo credentials use shared passwords and must be rotated before real use.
