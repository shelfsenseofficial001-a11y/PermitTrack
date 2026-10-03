# PermitTrack

A permit application & review system for residents/businesses and city staff, built from the PermitTrack-Flow prototype deck. PHP + MySQL backend (plain PDO, no framework), Vue 3 + Tailwind CSS frontend (loaded via CDN/import maps — no build step required).

## Setup (XAMPP)

1. Start Apache and MySQL in the XAMPP control panel.
2. Import the schema, then the migrations in order:
   ```
   mysql -u root < database/schema.sql
   mysql -u root permittrack < database/migrations/001_user_levels.sql
   mysql -u root permittrack < database/migrations/002_resident_verification.sql
   mysql -u root permittrack < database/migrations/003_businesses.sql
   mysql -u root permittrack < database/migrations/004_admin_tools.sql
   mysql -u root permittrack < database/migrations/005_chatbot.sql
   mysql -u root permittrack < database/migrations/006_notifications.sql
   mysql -u root permittrack < database/migrations/007_notification_reads.sql
   ```
   or import the same files in phpMyAdmin. Migrations are safe to run more than once.

   > **Importing SQL that contains accented characters (ñ, é, …)?** Add
   > `--default-character-set=utf8mb4` to the `mysql` command. On Windows the client otherwise
   > sends the console codepage, and characters like **ñ** get stored wrong (it has already
   > turned `Dasmariñas` into `Dasmari±as` once). The app's own PHP/PDO path is utf8mb4
   > end-to-end and is not affected — only command-line imports are.
3. (Optional) Copy `api/config.local.example.php` to `api/config.local.php` to set up real email (SMTP) and SMS
   (Semaphore or Twilio). Until then, verification codes are written to `storage/outbox.log` and shown on the
   verify screen in a "Test mode" box.
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
