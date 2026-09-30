-- 007: Separate "seen" from "read" for notifications.
--   seen  — the user opened the bell. Clears the badge count. (users.notifications_seen_at, from 006)
--   read  — the user opened that notification, or pressed "Mark all as read". Clears the unread
--           dot and highlight. Stored as a cut-off time plus individual reads after it.
-- Without the split, opening the bell marked everything read, so the Notifications page could
-- never show anything as unread.
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/007_notification_reads.sql

USE permittrack;

-- "Everything up to here is read" — moved by "Mark all as read"
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
               AND COLUMN_NAME = 'notifications_read_at');
SET @sql := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN notifications_read_at DATETIME NULL AFTER notifications_seen_at',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Start the read line where the seen line already is, so nothing the user has already
-- cleared suddenly reappears as unread after this migration
UPDATE users SET notifications_read_at = notifications_seen_at
WHERE notifications_read_at IS NULL AND notifications_seen_at IS NOT NULL;

-- Individual notifications opened after the cut-off
CREATE TABLE IF NOT EXISTS notification_reads (
    user_id INT NOT NULL,
    activity_id INT NOT NULL,
    read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, activity_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (activity_id) REFERENCES application_activity(id) ON DELETE CASCADE
) ENGINE=InnoDB;
