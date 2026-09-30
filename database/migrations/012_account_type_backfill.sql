-- 012: Backfill users.account_type for accounts that only have an approved business.
--
-- account_type is informational only — nothing gates access on it (that's resident_status +
-- approved-business-count, via with_levels() in api/config.php) — but it defaults to 'resident'
-- for every signup (api/auth.php's INSERT never sets it) and was never updated afterward, so a
-- business-only account (no verified residency) stayed mislabeled 'resident' forever. Business
-- approval (api/business.php) now sets it going forward; this backfills existing rows.
--
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/012_account_type_backfill.sql

USE permittrack;

UPDATE users u
SET u.account_type = 'business'
WHERE u.account_type = 'resident'
  AND EXISTS (SELECT 1 FROM businesses b WHERE b.user_id = u.id AND b.status = 'approved');
