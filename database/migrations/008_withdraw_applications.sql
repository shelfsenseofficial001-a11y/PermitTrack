-- 008: Let an applicant correct or withdraw a permit they have just filed.
--
-- "Withdrawn" is a status rather than a delete: the application, its documents and its
-- activity trail all stay, so staff can still see that something was filed and taken back.
-- It drops out of the review queues the same way Approved and Rejected do.
--
-- Editing and withdrawing are only allowed while the application is still sitting in the
-- "New" bucket (status = 'Submitted' and nobody assigned). Once a reviewer has it, the
-- applicant can no longer change it underneath them — see api/applications.php.
--
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/008_withdraw_applications.sql

USE permittrack;

-- Re-declaring the enum with the extra value is idempotent: running it twice is a no-op.
ALTER TABLE applications
  MODIFY COLUMN status ENUM(
    'Submitted','Under Review','Inspection Scheduled','Inspector Notes',
    'Approved','Rejected','Withdrawn'
  ) NOT NULL DEFAULT 'Submitted';

-- When it was withdrawn, so the detail page can say so. NULL for everything else.
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
               AND COLUMN_NAME = 'withdrawn_at');
SET @sql := IF(@col = 0,
  'ALTER TABLE applications ADD COLUMN withdrawn_at DATETIME NULL AFTER status',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
