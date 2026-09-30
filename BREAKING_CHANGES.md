# Breaking Changes & Migration Notes — Permit Pipeline

Running log of every breaking point introduced or discovered while wiring
the multi-office permit pipeline (barangay routing, expanded permit types,
branching conditions). Read this before touching `api/reviewer.php`,
`api/applications.php`, `api/lib/business.php`, `api/config.php`, or any
`permit_type`-related frontend component.

Reference: the design spec doc created earlier in this project
("PermitTrack — Staff Levels & Permit Scope Spec").

---

## 1. `departments.permit_types = ''` no longer means "new, unconfigured"

**Before:** an empty CSV in `departments.permit_types` meant "no restriction
configured yet" and `reviewable_permit_types()` in `api/config.php` treated
it as **"sees every permit type"** (`empty(...) → return null → all`).

**Now:** migration `008_permit_pipeline.sql` seeded 84 new department rows
(75 barangay secretariats + 9 city offices) with `permit_types =
'__unassigned__'` instead of empty, specifically to avoid that "sees
everything" default. If you ever see a department with `permit_types = ''`
after this point, that's the *old* meaning (unrestricted), not a leftover
placeholder — don't clear a department's `permit_types` expecting it to mean
"not yet wired up."

**Follow-up risk:** `reviewable_permit_types()` and `department_filter()` in
`api/config.php` / `api/reviewer.php` still only understand the CSV model.
They do not yet know about `application_pipeline_progress` (added below).
Until they're updated, staff assigned to a barangay/office department see an
**empty queue**, not a broken one — confirmed intentional, not a bug.

## 2. Old `permit_type` enum and new `permit_types` table are two sources of truth

`applications.permit_type` (5-value ENUM) is untouched and still what
`api/lib/business.php::PERMIT_ELIGIBILITY`, `required_documents_for()`, and
every frontend component (`NewApplication.js`, `PermitDetail.js`,
`ReviewerQueue.js`, etc.) read. `applications.permit_type_id` (27-value FK)
is new and additive.

**Anything that filters/labels by permit type has to be updated in two
places until the old column is retired.** Do not add a new permit type only
to `permit_types` and assume the app sees it — `PERMIT_ELIGIBILITY` and the
enum must be extended too, or the new type will submit but never display
correctly in old UI paths that assume the 5-value list.

## 3. Missing per-application pipeline state (added in `009_pipeline_progress.sql`)

`permit_pipeline_steps` (from 008) is a **template** — it describes each
permit type's route in the abstract. There was no table recording *which
office a specific application is actually waiting on right now*. Added
`application_pipeline_progress`: one row per resolved step for a given
application, with `status` (`pending` / `current` / `approved` / `rejected`
/ `skipped`) and a concrete `department_id` (the `BARANGAY` sentinel
resolved to the applicant's or business's actual barangay department at
submission time, per the spec's routing rule).

**Legacy applications** (submitted before this wiring, or via any path that
doesn't call `instantiate_pipeline()`) have **zero** `application_pipeline_progress`
rows. Every piece of code that reads this table must treat "no rows" as
"this application predates the pipeline" and fall back to the old
single-stage `applications.status` flow — never assume every application
has a pipeline.

## 4. Forced branch questions can void a permit — enforced in the API layer, not the DB

Per the spec: an unanswered/false-declared branch condition that turns out
to apply voids the permit; the risk sits with the applicant. The DB layer
(`application_conditions`) just stores answers — it does not itself detect a
false declaration or cancel anything. That enforcement lives in
`api/lib/pipeline.php::instantiate_pipeline()` (submission-time: every
branch question for the chosen permit type must have an answer, or
submission is rejected outright) and is **not yet implemented** for the
"staff discovers an undeclared condition mid-review" case — that still
requires a manual reviewer action (reject + reapply) until a dedicated
"void for false declaration" action is built.

## 5. Barangay/office staff accounts exist but have no admin UI yet

75 Barangay Secretary + 9 office department rows and accounts exist in the
DB (migration 008) but `Admin.js`'s department/staff management screens
were written for the original 3-department model and have not been
reviewed against 84 new rows. Expect an admin department list/picker that
was sized for ~3 entries to be unusable at 84 until that UI is revisited.

---

## Status

| Layer | Status |
| --- | --- |
| DB schema (barangays, permit_types, pipeline_steps, pipeline_progress, conditions) | Done |
| `api/lib/pipeline.php` (routing engine) | In progress |
| `api/applications.php` submission wired to pipeline | In progress |
| `api/reviewer.php` queue/decision wired to pipeline | In progress |
| `NewApplication.js` (permit type + branch question UI) | Not started |
| `ReviewerQueue.js` / `PermitDetail.js` (pipeline stage display) | Not started |
| `Admin.js` (barangay/office management UI) | Not started |
