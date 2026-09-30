-- 013: Expand account_type to 4 values and fix every remaining mislabel.
--
-- account_type defaulted to 'resident' for EVERY new row (applicants who never verified
-- anything, and every staff/admin/barangay-secretary account too — none of them ever set the
-- column). 012 only fixed accounts with an approved business. This migration:
--   - adds 'unregistered' (an applicant who hasn't verified residency or a business yet —
--     what used to silently default to the misleading 'resident')
--   - adds 'staff' (role IN ('staff','admin') — was also defaulting to 'resident')
--   - backfills every existing row to the value that actually matches it
--   - changes the column default to 'unregistered' so future signups start correctly
--
-- Still informational only — nothing gates access on this column (that's resident_status +
-- approved-business-count via with_levels() in api/config.php).
--
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/013_account_type_expand.sql

USE permittrack;

ALTER TABLE users
    MODIFY account_type ENUM('unregistered', 'resident', 'business', 'staff') NOT NULL DEFAULT 'unregistered';

-- Staff and admin accounts (demo staff, admin, 75 barangay secretaries, 9 office staff)
UPDATE users SET account_type = 'staff' WHERE role IN ('staff', 'admin') AND account_type <> 'staff';

-- Applicants with an approved business (precedence over resident, same rule as migration 012)
UPDATE users u
SET u.account_type = 'business'
WHERE u.role = 'applicant'
  AND u.account_type <> 'business'
  AND EXISTS (SELECT 1 FROM businesses b WHERE b.user_id = u.id AND b.status = 'approved');

-- Verified residents with no approved business
UPDATE users u
SET u.account_type = 'resident'
WHERE u.role = 'applicant'
  AND u.resident_status = 'verified'
  AND u.account_type NOT IN ('resident', 'business');

-- Everyone else (never verified residency, no approved business) — was defaulting to 'resident'
UPDATE users u
SET u.account_type = 'unregistered'
WHERE u.role = 'applicant'
  AND u.resident_status <> 'verified'
  AND u.account_type = 'resident'
  AND NOT EXISTS (SELECT 1 FROM businesses b WHERE b.user_id = u.id AND b.status = 'approved');
