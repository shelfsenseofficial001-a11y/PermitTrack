-- 006: In-app notifications. The feed itself is derived from application_activity — every
-- stage change and reviewer message on an applicant's permits becomes a notification — so
-- there is no separate notifications table to keep in sync. All we store is how far the
-- user has read.
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/006_notifications.sql

USE permittrack;

-- MariaDB has no "ADD COLUMN IF NOT EXISTS" in every version, so guard it.
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
               AND COLUMN_NAME = 'notifications_seen_at');
SET @sql := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN notifications_seen_at DATETIME NULL AFTER onboarding_completed',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- The feed reads activity by application and date; this keeps that cheap.
SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_activity'
               AND INDEX_NAME = 'idx_activity_app_created');
SET @sql := IF(@idx = 0,
  'CREATE INDEX idx_activity_app_created ON application_activity (application_id, created_at)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
