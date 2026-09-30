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

## 5. `applications.permit_type` (old enum) is now nullable

Migration `010_permit_type_nullable.sql`. The old 5-value `ENUM` is `NOT
NULL` in strict SQL mode, so a pipeline submission (`create_v2`) that picks
one of the 22 new permit types can't write anything valid into it — it's
left `NULL` and `permit_type_id` + a join to `permit_types.name` is the
real source of truth for those applications. **Any code that reads
`application.permit_type` directly (most of the current frontend) will see
`NULL`/blank for every application filed through the new pipeline path**
until that frontend is updated to read `permit_type_name` (from the
`permit_types` join) instead. Applications filed through the old `create`
action are unaffected — they still populate the enum exactly as before.

## 6. Two parallel submission and review action pairs, by design (for now)

`api/applications.php` has `create` (old, 5-type, untouched) and
`create_v2` (new, 27-type, pipeline-driven) side by side.
`api/reviewer.php` has `queue`/`counts`/`decision` (old, CSV-department,
untouched) and `pipeline_queue`/`pipeline_counts`/`pipeline_decision` (new,
per-office-current-step) side by side. This was a deliberate choice to
avoid breaking the 3 departments (OBO/BPLO/CHO) that already work — but it
means **the frontend has to actively choose which pair to call**, and
nothing currently does that automatically. Until `NewApplication.js` and
`ReviewerQueue.js` are updated, `create_v2`/`pipeline_*` are reachable only
by calling the API directly (verified via a rolled-back smoke test against
the live DB, not through the UI).

## 7. Barangay/office staff accounts exist but have no admin UI yet

75 Barangay Secretary + 9 office department rows and accounts exist in the
DB (migration 008) but `Admin.js`'s department/staff management screens
were written for the original 3-department model and have not been
reviewed against 84 new rows. Expect an admin department list/picker that
was sized for ~3 entries to be unusable at 84 until that UI is revisited.

---

## 8. Chat bot updated for the pipeline (migration 014 + api/lib/chatbot.php)

The chat bot (`api/lib/chatbot.php`) had three separate dependencies on the old 5-type model,
none of which raised an error — they just silently gave wrong or incomplete answers:

- `CHAT_PERMIT_WORDS` was a hardcoded 5-entry array, so "what does a fencing permit need"
  matched nothing. Replaced with a live query against `permit_types` (all 27, matched by name +
  a `CHAT_PERMIT_SYNONYMS` list of colloquial terms), so a permit type added to the DB later is
  answerable immediately without an app code change.
- `chat_permit_requirements()` called the old `required_documents_for()` (business.php, 5-type
  map) and `PERMIT_ELIGIBILITY` (same). Now calls `required_documents_for_type()` and reads
  `resident_eligible`/`business_eligible` straight off `permit_types`.
- `chat_my_status()` selected `applications.permit_type` directly — null for every pipeline
  application (migration 010). It would have silently printed "permit: Submitted" with no type
  name. Now joins `permit_types.name` as a fallback and additionally reports the current pipeline
  stage ("currently with Barangay Burol I Secretariat") when the application has one.

FAQ content (`faq_entries`) updated: 4 existing answers rewritten to describe the 27-type
catalog and multi-office routing instead of the old 5 types; 4 new entries added (how the
multi-office review works, why branch questions exist, what standalone barangay clearances are,
why the barangay on file matters). Verified via a rolled-back DB smoke test covering every new
code path, then live through the actual chat widget in-browser (fencing permit question, zero
console errors, correct JSON response).

## 9. Chat bot: landing-page access, language choice, off-topic refusal, injection guard

- `ChatWidget` is now also mounted on `Landing.js` (public, signed-out page) — previously only
  inside `AppShell` for signed-in applicants. The backend already handled a null `$user`
  gracefully, so no API changes were needed for this part.
- **Language gate**: `api/chat.php`'s `start` action now returns a language-choice prompt
  (English/Tagalog) instead of the greeting when `$_SESSION['chat_lang']` isn't set yet; `ask`
  reads the reply as a language pick before treating anything as a real question. Every
  subsequent reply in that session is in the chosen language.
  `faq_entries` gained `question_tl`/`answer_tl` (migration 015, all 20 entries translated) —
  null falls back to English. Dynamic (non-FAQ) strings — greeting, my-status, permit
  requirements, fallback, refusals — live in `CHAT_LANG_STRINGS`/`chat_t()` in
  `api/lib/chatbot.php`. `api/admin.php`'s `faq_save` and `Admin.js`'s FAQ form now accept the
  Tagalog fields too, so city staff can maintain both languages without touching a migration.
- **Off-topic refusal**: a message that matches no FAQ AND contains none of
  `CHAT_ON_TOPIC_HINTS` gets a firm "I only answer PermitTrack questions" refusal (`intent:
  'off_topic'`) instead of the softer "I don't have an answer for that yet" (`intent: 'fallback'`,
  reserved for genuine system questions the FAQ table just doesn't cover yet).
- **Prompt-injection guard**: `chat_is_injection_attempt()` checks the raw message against
  `CHAT_INJECTION_PATTERN` (ignore-instructions, reveal-system-prompt, jailbreak/DAN/developer-mode,
  role-play-as phrasing) *before* any other matching runs, so an injection attempt can't be
  disguised as a legitimate FAQ query. There is no LLM system prompt here to actually leak — this
  bot is deterministic keyword matching — but the guard still stops it being made to role-play or
  claim it has "instructions" to reveal.
- **Found and fixed while testing**: "What documents do I need to register a business?" and the
  new "What are barangay clearances?" both listed `barangay clearance` as a keyword and scored an
  *exact tie* on any message containing that phrase — the stable sort kept whichever was seeded
  first (the wrong, less specific answer). Migration 016 removed the ambiguous keyword and added
  Tagalog keyword phrases to the 4 entries added in migration 014 (their keywords were
  English-only, so a purely Tagalog phrasing of the same question wouldn't score as well as the
  English one). This kind of collision is a standing risk any time two FAQ entries share a
  generic keyword — worth checking after adding new entries.

Verified via a CLI smoke test (language detection, Tagalog answers for new and old FAQs,
off-topic refusal, 3 injection phrasings, an on-topic-but-unmatched question) and live through
the actual chat widget in-browser.

## 10. `mysql.exe` CLI silently corrupted non-ASCII bytes on file-redirect INSERTs

Found while verifying the chat bot's Tagalog answers in-browser: the em-dash in "Why does my
barangay matter?" rendered as `ÔÇö` instead of `—`. Traced to the Windows `mysql.exe` client:
running a migration file with `mysql.exe -u root permittrack < file.sql` occasionally mangles a
multi-byte UTF-8 character partway through a large statement — reproduced with the exact
`barangays` INSERT from migration 008 in isolation. `--default-character-set=utf8mb4` did **not**
fix it. The app's own PDO connection (`api/config.php`, `charset=utf8mb4`) is unaffected — this is
purely a CLI-client bug, and every migration in this project was applied via that CLI.

**Scope, found by scanning the whole DB for the CP437 box-drawing bytes this specific corruption
produces**: exactly 12 rows, all containing "Santo Niño" or "Dasmariñas" (the only non-ASCII
characters in any migration so far) — `barangays` (2), `departments.name`/`description` (6),
`faq_entries.answer`/`answer_tl` (2), `users.full_name` (2). All 12 fixed directly via a PDO
script (not another CLI migration — that would risk re-corrupting them), verified with a
second full-DB scan (zero matches) and confirmed live through the chat widget.

**Going forward**: any future migration containing non-ASCII characters (ñ, em-dash, accented
names, etc.) must be verified after applying — run a query back over the specific value and
visually diff it, or scan for `REGEXP '[\\x{2500}-\\x{25FF}]'` — rather than trusted just because
`mysql.exe` exited 0. Pure-ASCII migrations are unaffected and don't need this check.

## Status

| Layer | Status |
| --- | --- |
| DB schema (barangays, permit_types, pipeline_steps, pipeline_progress, conditions) | Done |
| `api/lib/pipeline.php` (routing engine) | Done — verified with a rolled-back smoke test against the live DB |
| `api/applications.php` — `permit_types` + `create_v2` actions | Done, additive (old `eligibility`/`create` untouched) |
| `api/reviewer.php` — `pipeline_queue`/`pipeline_counts`/`pipeline_decision` | Done, additive (old `queue`/`counts`/`decision` untouched) |
| `NewApplication.js` (permit type + branch question UI) | Done — verified end-to-end in browser (submit → routing → approval) |
| `ReviewerQueue.js` / `ReviewDetail.js` / `PermitDetail.js` (pipeline stage display + decisions) | Done — verified end-to-end in browser, both barangay-secretary and legacy staff paths |
| `Admin.js` (barangay/office management UI) | Not started |

### Document requirements (added — migration 011)

Fixed: `required_documents_for()` (api/config.php) was still keyed by the old 5-value enum, so
the new-catalog `NewApplication.js` form collected no documents for any of the 22 new permit
types. Added `permit_type_documents` (migration 011, seeded for all 27 types) and
`required_documents_for_type()` in `api/lib/pipeline.php`; `permit_types_catalog()` now attaches
`required_documents` to each catalog entry, `NewApplication.js` renders upload fields for them,
and `create_v2` saves them as `application_documents` rows exactly like the legacy `create`
action does. Verified end-to-end in-browser: submitted a Business License with no files attached
and confirmed the three required documents show correctly as "Not uploaded yet" with a working
Re-upload action on the detail page.

Two docs are duplicated between a permit type and its embedded-stage-1 barangay clearance (e.g.
Business License's "Business Formation Document" list doesn't re-ask for the Barangay Business
Clearance itself, since that's the pipeline's own first step, not an applicant-uploaded file) —
by design, not an oversight.

### Frontend wiring notes (added after browser verification)

- `ReviewerQueue.js`/`ReviewDetail.js` decide which mode to use per staff member via
  `authState.user.department_permit_types === '__unassigned__'` — this is the same
  placeholder from migration 008 doing double duty as a UI-mode flag, not just an access-control
  default. If that placeholder value is ever changed, both the API layer (`config.php`,
  `reviewer.php`) and these two components need to change together.
- Verified in-browser as a full round trip: applicant submits a Fencing Permit answering "yes" to
  the waterway branch question → routed to Barangay Salitran I Secretariat → barangay secretary
  logs in, sees it in `pipeline_queue`, approves it → application correctly advances to OBO and
  is no longer actionable by the barangay account ("not your office" guard fires correctly).
