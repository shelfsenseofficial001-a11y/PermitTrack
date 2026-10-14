-- ---------------------------------------------------------------------------
-- 035 — Hard-copy delivery for an approved permit
--
-- Once a permit is Approved, the applicant can ask for it to be delivered instead of picked
-- up at the office. delivery_method records that one-time choice; delivery_address and
-- delivery_fee are snapshotted at the moment it's made (the flat fee can change later without
-- rewriting what an applicant already agreed to pay, and an edited home address afterward
-- shouldn't silently move where something already being prepared gets sent).
--
-- delivery_status is staff's own tracking of the physical handoff — Preparing, then Out for
-- Delivery, then Delivered — independent of applications.status, which stays 'Approved'
-- throughout. It is NULL until delivery is actually chosen (pickup never sets it) and starts
-- at 'preparing' the moment it is.
--
-- Idempotent: every column is added only if absent.
-- ---------------------------------------------------------------------------

SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'delivery_method');
SET @s1 := IF(@c1 = 0, "ALTER TABLE applications ADD COLUMN delivery_method ENUM('pickup','delivery') NULL AFTER status", 'DO 0');
PREPARE s1 FROM @s1; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @c2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'delivery_address');
SET @s2 := IF(@c2 = 0, 'ALTER TABLE applications ADD COLUMN delivery_address VARCHAR(255) NULL AFTER delivery_method', 'DO 0');
PREPARE s2 FROM @s2; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @c3 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'delivery_fee');
SET @s3 := IF(@c3 = 0, 'ALTER TABLE applications ADD COLUMN delivery_fee DECIMAL(8,2) NULL AFTER delivery_address', 'DO 0');
PREPARE s3 FROM @s3; EXECUTE s3; DEALLOCATE PREPARE s3;

SET @c4 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'delivery_status');
SET @s4 := IF(@c4 = 0, "ALTER TABLE applications ADD COLUMN delivery_status ENUM('preparing','out_for_delivery','delivered') NULL AFTER delivery_fee", 'DO 0');
PREPARE s4 FROM @s4; EXECUTE s4; DEALLOCATE PREPARE s4;

SET @c5 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'delivery_requested_at');
SET @s5 := IF(@c5 = 0, 'ALTER TABLE applications ADD COLUMN delivery_requested_at DATETIME NULL AFTER delivery_status', 'DO 0');
PREPARE s5 FROM @s5; EXECUTE s5; DEALLOCATE PREPARE s5;

SET @c6 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'delivery_updated_at');
SET @s6 := IF(@c6 = 0, 'ALTER TABLE applications ADD COLUMN delivery_updated_at DATETIME NULL AFTER delivery_requested_at', 'DO 0');
PREPARE s6 FROM @s6; EXECUTE s6; DEALLOCATE PREPARE s6;
