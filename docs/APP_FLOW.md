# NagarMitra — App Flow

## 1. Entry & role routing

```
/  ->  signed out?  -> /auth
       citizen      -> /app
       worker       -> /staff
       staff        -> /overview
```

`/auth`: language picker, then persona choice.
- **Resident** — sign in, create account, or Continue with Google.
- **Field worker** — sign in only (accounts issued by the ward office).
If a different account is already signed in, the screen offers **Continue** or
**Use another account** (signs out first) so no one lands in the wrong console.

## 2. Resident: report a problem

```text
/app/report
  1 Open camera          (camera only - no gallery)
  2 Preview / Retake
  3 Read GPS             coarse or failed fix -> ask to retry outdoors
  4 Location name        reverse geocoded, plus landmark + note fields
  5 AI check             genuine waste? category, severity, amount, confidence
        not genuine  -> rejected with reason, offer retake
  6 Quality panel        score + what helped / what is missing
  7 Duplicate scan       same area + category + similar image + recent
        high     -> blocked: "already reported" -> Support this report
        maybe    -> submitted, flagged for ward review
        none     -> submitted
  8 Submit               report created, timeline started, ward matched
  9 Success              -> /app/reports/:id
```

## 3. Resident: track & close the loop

```text
/app/reports        list: status, priority, ward, time
/app/reports/:id    photo, location facts, validation facts, timeline,
                    assigned worker, completion evidence when resolved
   status pending / not yet actioned -> Delete report (confirm dialog)
   status in progress                -> Withdraw report (kept, read-only)
   status resolved                   -> Verify cleanup:
        Confirm -> report closed
        Reject  -> reopened, 6-hour deadline, ward notified
```

## 4. Resident: segregation guide

```text
/app/segregate -> capture item -> AI classifies
   -> bin label + colour + stream + disposal guidance + warnings
   -> optional feedback / correct the category
```

## 5. Field worker

```text
/staff              duty toggle (on duty / off duty), today's load
/staff/reports      assigned jobs
/staff/reports/:id  location, category, severity, resident note, map
   Capture completion photo  (mandatory, camera only)
      -> read GPS
      -> distance to reported spot <= 120 m ?
           NO  -> refused, shows measured distance, job stays open
           YES -> evidence saved, job marked resolved,
                  resident asked to verify
```

## 6. Ward member (own ward) / Chairperson (all wards)

```text
/overview      KPIs: pending, in progress, overdue, resolved, escalations
/complaints    filterable list -> /complaints/:id
                 full timeline, validation + duplicate facts,
                 assign or reassign worker, adjust priority (with reason),
                 completion evidence
/map           complaints plotted by ward
/zones         ward directory: number, name, ward member, covered areas
/workers       roster, duty state, ward, performance; issue worker accounts
/escalations   overdue and auto-escalated reports
/reports       trends and summaries
/settings      response-time (SLA) config per priority
```

## 7. Automatic behaviour

- New account → profile + role created; worker accounts also get a worker row.
- New report → nearest ward matched, deadline set from priority.
- Deadline passed → status `escalated`, level +1, deadline extended, logged.
- Any state change → immutable timeline entry visible to resident and staff.

## 8. Status lifecycle

```
pending -> assigned -> in_progress -> resolved -> closed
   |            |            |            |
   |            +------------+---> escalated (deadline missed) --+
   |                                                            |
   +--> cancelled (resident withdrew)      resolved -> reopened (resident rejected)
```
