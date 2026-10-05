# PermitTrack

A permit application & review system for residents/businesses and city staff, built from the PermitTrack-Flow prototype deck. PHP + MySQL backend (plain PDO, no framework), Vue 3 + Tailwind CSS frontend (loaded via CDN/import maps — no build step required).

## Setup (XAMPP)

1. Start Apache and MySQL in the XAMPP control panel.
2. Import the schema, then every migration in order:
   ```
   mysql -u root --default-character-set=utf8mb4 < database/schema.sql
   for f in database/migrations/*.sql; do
     mysql -u root --default-character-set=utf8mb4 permittrack < "$f"
   done
   ```
   or import the files in phpMyAdmin, in filename order. Migrations are safe to run more
   than once, so re-running the whole set is the way to bring an existing database up to date.

   <details><summary>The 34 migrations, in order</summary>

   ```
   001_user_levels.sql
   002_resident_verification.sql
   003_businesses.sql
   004_admin_tools.sql
   005_chatbot.sql
   006_notifications.sql
   007_notification_reads.sql
   008_permit_pipeline.sql
   008_withdraw_applications.sql
   009_pipeline_progress.sql
   010_permit_type_nullable.sql
   011_permit_type_documents.sql
   012_account_type_backfill.sql
   013_account_type_expand.sql
   014_chatbot_faq_pipeline_update.sql
   015_chatbot_language.sql
   016_chatbot_faq_keyword_fixes.sql
   017_encoding_fix.sql
   018_encoding_fix2.sql
   019_office_staff_accounts.sql
   020_business_permit_renewal.sql
   021_document_handlers.sql
   022_lto.sql
   023_lto_scope_back_to_mtop.sql
   024_permit_descriptions.sql
   025_application_barangay.sql
   026_address_psgc.sql
   027_chatbot_business_scope.sql
   028_verification_barangay_scope.sql
   029_rename_burol_main.sql
   030_google_sign_in.sql
   031_document_intake_stage.sql
   032_document_reject_reason.sql
   033_activity_event.sql
   ```
   Two files share the `008` prefix; filename order (`permit_pipeline` before
   `withdraw_applications`) is the correct order.
   </details>


   > **Importing SQL that contains accented characters (ñ, é, …)?** Add
   > `--default-character-set=utf8mb4` to the `mysql` command. On Windows the client otherwise
   > sends the console codepage, and characters like **ñ** get stored wrong (it has already
   > turned `Dasmariñas` into `Dasmari±as` once). The app's own PHP/PDO path is utf8mb4
   > end-to-end and is not affected — only command-line imports are.
3. (Optional) Copy `api/config.local.example.php` to `api/config.local.php` to set up real email (SMTP) and SMS
   (Semaphore or Twilio). Until then, verification codes are written to `storage/outbox.log` and shown on the
   verify screen in a "Test mode" box.

   **Sign in with Google** is off until `google.client_id` is set there. To turn it on:
   1. In [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials),
      create an **OAuth client ID** of type **Web application** (set up the OAuth consent screen first if asked).
   2. Under **Authorized JavaScript origins**, add the origin the site is opened from — `http://localhost` for
      XAMPP (add `http://localhost:8080` etc. if Apache uses another port). No redirect URI is needed.
   3. Put the client ID in `api/config.local.php`: `'google' => ['client_id' => '…apps.googleusercontent.com']`.

   The Google button then appears on Log in and Sign up. The server verifies Google's ID token itself (signature,
   audience, expiry, verified email) before signing anyone in. An existing account with the same email is linked on
   first use; a new person finishes a short sign-up (birthdate, address, consent) with no code and no password.
   City Staff accounts can't use Google and keep signing in on the Staff Portal.
4. Visit `http://localhost/PermitTrack-main/` in your browser. Signed-out visitors see the landing page; signed-in users go straight to their dashboard or queue.

## User levels

| Level | How it's granted | Can do |
|---|---|---|
| Normal User | Self sign-up (email **or** mobile, verified with a 6-digit code) | Browse permits and requirements |
| Resident | Normal User + verified email **and** mobile + two proofs of residence, approved by City Staff | Apply for resident permits |
| Business Owner | Normal User + at least one business approved by City Staff (DTI/SEC/CDA registration, TIN, representative ID, barangay clearance, proof of location) | Apply for business permits for that business |
| City Staff | Created by an Admin (temporary password, changed on first sign-in) | Review verifications, and permit applications for their department |
| Admin | Created by an Admin | Everything City Staff can do across all departments, plus the Admin page: staff accounts, departments, public accounts, audit log |

Resident and Business Owner are labels on the same account — one person can be both.

## Accounts

- **Residents / businesses**: sign up from the login screen.
- **City Staff** (demo): `staff@hotmail.com` / `Password123!` — sign in at `#/staff/login`
- **Admin** (demo): `admin@hotmail.com` / `Password123!` — sign in at `#/staff/login`

## Structure

- `api/` — PHP REST-style endpoints (session auth, PDO/MySQL)
  - `api/lib/notify.php` — email (SMTP) and SMS (Semaphore/Twilio) sending
  - `api/lib/verification.php` — one-time verification codes
  - `api/lib/support.php` — private file storage, audit log, user notifications
  - `api/lib/residency.php` — accepted proofs of residence
  - `api/lib/business.php` — ownership types, required business documents, which permits need which label
  - `api/lib/chatbot.php` — built-in FAQ assistant (`chatbot_reply()` is the single entry point, so it can be swapped for an AI model later)
- `database/schema.sql` — base schema + demo staff account; `database/migrations/` — changes applied after it
- `storage/` — private app data: outbox log, residency proofs and business documents (blocked from the web; served only to the owner and staff)
- `uploads/` — uploaded permit documents (not web-accessible directly; served through `api/documents.php`)
- `index.html` + `assets/js/` — Vue 3 SPA (ES modules, no bundler), Tailwind via CDN

## Flow implemented

1. Sign up as a Normal User (3-step form + email/SMS code), log in with email or mobile number
2. Dashboard with account level, stat tiles and a 5-stage permit status stepper
3. Resident upgrade: add the missing email/mobile, two proofs of residence, declaration; staff approve or reject with a reason
4. Business upgrade: register one or more businesses with their documents; a rejected business can be fixed and resubmitted
5. Browse permits (Normal Users) / new application form: file as yourself (Resident) or for a verified business
6. Permit detail page: documents, activity log, messaging with the reviewer
7. Staff Portal login (City Staff and Admin)
8. Reviewer queue (New / In Progress / Awaiting Applicant) for city staff
9. Review detail: approve/reject documents, change status, notify applicant
10. Resident and Business Verification queues for staff: view proofs, approve or reject with a reason, notifies the applicant
11. Admin page (`#/admin`): create/edit staff and assign departments, deactivate accounts, reset passwords, manage departments and the permit types they review, search public accounts, browse the audit log
12. Change password dialog (account menu, Profile → Security, staff header). After an Admin sets a temporary password it opens by itself on every page and cannot be dismissed until a new password is set. Old `#/account/password` links open the dialog
13. FAQ chat assistant ("Ask" button on resident/business pages): answers from Admin-editable FAQ entries, live permit requirements and the user's own status; unanswered questions are listed in Admin → Chat bot
