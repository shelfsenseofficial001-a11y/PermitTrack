-- ---------------------------------------------------------------------------
-- 042 -- Delivery is free; barangay pickup; per-node delivery tracking
--
-- Three changes:
--
-- 1. Delivery stops costing anything. applications.delivery_fee is NOT dropped -- ReviewerQueue.js,
--    ReviewDetail.js and PermitDetail.js all still read it to show what was charged on permits
--    approved before this migration -- but every row is zeroed, and nothing after this migration
--    ever writes a nonzero value into it again (api/config.php DELIVERY_FEE becomes 0.00).
--
-- 2. 'barangay_pickup' joins 'pickup' (at the issuing office) and 'delivery' (to an address) as a
--    third way to receive an approved permit's files: picked up at the applicant's own barangay
--    hall, which for most permits is far closer than the city office that issued it.
--
-- 3. Per-node delivery tracking: application_pipeline_progress gets the same five
--    delivery_method/address/fee/status/requested_at/updated_at columns applications already has
--    (035_delivery.sql), rather than a second, different scheme -- a node's own choice and status
--    reuse the exact same enums. Delivery was previously only ever chosen once, after the whole
--    application was Approved; now any node that has just finished and produced output files
--    (documents it owns, now Verified) can be collected the same way, one node at a time, without
--    waiting for the very last office to sign off.
--
-- Idempotent: enum widened only if the value is missing, columns added only if absent, and the
-- fee zeroing is a plain idempotent UPDATE.
-- ---------------------------------------------------------------------------

UPDATE applications SET delivery_fee = 0 WHERE delivery_fee IS NOT NULL AND delivery_fee <> 0;

SET @e := (SELECT COLUMN_TYPE FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'delivery_method');
SET @s := IF(@e NOT LIKE '%barangay_pickup%',
  "ALTER TABLE applications MODIFY COLUMN delivery_method ENUM('pickup','delivery','barangay_pickup') NULL",
  'DO 0');
PREPARE s FROM @s; EXECUTE s; DEALLOCATE PREPARE s;

-- application_pipeline_progress: the same delivery columns applications already carries ---------
SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_pipeline_progress' AND COLUMN_NAME = 'delivery_method');
SET @s1 := IF(@c1 = 0,
  "ALTER TABLE application_pipeline_progress ADD COLUMN delivery_method ENUM('pickup','delivery','barangay_pickup') NULL AFTER freeze_kind",
  'DO 0');
PREPARE s1 FROM @s1; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @c2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_pipeline_progress' AND COLUMN_NAME = 'delivery_address');
SET @s2 := IF(@c2 = 0, 'ALTER TABLE application_pipeline_progress ADD COLUMN delivery_address VARCHAR(255) NULL AFTER delivery_method', 'DO 0');
PREPARE s2 FROM @s2; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @c3 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_pipeline_progress' AND COLUMN_NAME = 'delivery_status');
SET @s3 := IF(@c3 = 0,
  "ALTER TABLE application_pipeline_progress ADD COLUMN delivery_status ENUM('preparing','out_for_delivery','delivered') NULL AFTER delivery_address",
  'DO 0');
PREPARE s3 FROM @s3; EXECUTE s3; DEALLOCATE PREPARE s3;

SET @c4 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_pipeline_progress' AND COLUMN_NAME = 'delivery_requested_at');
SET @s4 := IF(@c4 = 0, 'ALTER TABLE application_pipeline_progress ADD COLUMN delivery_requested_at DATETIME NULL AFTER delivery_status', 'DO 0');
PREPARE s4 FROM @s4; EXECUTE s4; DEALLOCATE PREPARE s4;

SET @c5 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_pipeline_progress' AND COLUMN_NAME = 'delivery_updated_at');
SET @s5 := IF(@c5 = 0, 'ALTER TABLE application_pipeline_progress ADD COLUMN delivery_updated_at DATETIME NULL AFTER delivery_requested_at', 'DO 0');
PREPARE s5 FROM @s5; EXECUTE s5; DEALLOCATE PREPARE s5;
