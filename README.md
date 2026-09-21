# PermitTrack

A permit application & review system for residents/businesses and city staff, built from the PermitTrack-Flow prototype deck. PHP + MySQL backend (plain PDO, no framework), Vue 3 + Tailwind CSS frontend (loaded via CDN/import maps — no build step required).

## Setup (XAMPP)

1. Start Apache and MySQL in the XAMPP control panel.
2. Import the schema:
   ```
   mysql -u root < database/schema.sql
   ```
   or open phpMyAdmin and import `database/schema.sql`.
3. Visit `http://localhost/PermitTrack/` in your browser.

## Accounts

- **Resident / Business**: sign up from the login screen.
- **City Staff** (demo account): `staff@permittrack.city` / `password123`

## Structure

- `api/` — PHP REST-style endpoints (session auth, PDO/MySQL)
- `database/schema.sql` — MySQL schema + demo staff account
- `uploads/` — uploaded permit documents (not web-accessible directly; served through `api/documents.php`)
- `index.html` + `assets/js/` — Vue 3 SPA (ES modules, no bundler), Tailwind via CDN

## Flow implemented

1. Sign up / log in (resident, business, or city staff)
2. Business onboarding (skippable for individuals)
3. Dashboard with stat tiles and a 5-stage permit status stepper
4. Permit detail page: documents, activity log, messaging with the reviewer
5. New application form with permit-type-specific required documents
6. Reviewer queue (New / In Progress / Awaiting Applicant) for city staff
7. Review detail: approve/reject documents, change status, notify applicant
