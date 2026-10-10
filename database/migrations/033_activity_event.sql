-- ---------------------------------------------------------------------------
-- 033 — Activity rows say what happened, instead of being guessed from their wording
--
-- The bell worked out what each event was by searching the sentence written for humans:
-- stripos($body, 'Needs Re-upload'), stripos($body, 'marked as Verified'), and so on. That broke
-- the moment migration 032 reworded a rejection to carry its reason — rejections quietly stopped
-- being recognised and fell through to a generic headline with a green tick beside it.
--
-- So the event is now recorded as a short code alongside the sentence. The wording is free to
-- change, be reworded or translated, and the bell keeps working.
--
--   doc_rejected   a document was sent back to the applicant
--   doc_verified   a document was approved by the office that owns it
--   doc_intake     a document passed the barangay's intake check
--   submitted      the application was filed
--   status         it moved to another stage or office
--   approved       the permit was approved / issued
--   rejected       the application was refused
--   message        a reviewer wrote to the applicant
--
-- NULL is allowed and means "older row, work it out from the text" — the fallback in
-- notifications.php still handles those, so nothing already in the table has to be perfect.
--
-- Backfill reads the existing wording, which is the one moment that guessing is the right tool:
-- these rows were written before the column existed. Most specific patterns first.
-- Idempotent: the column is added only if absent, and the backfill only fills rows still NULL.
-- ---------------------------------------------------------------------------

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_activity' AND COLUMN_NAME = 'event');
SET @s := IF(@c = 0, 'ALTER TABLE application_activity ADD COLUMN event VARCHAR(32) NULL AFTER type', 'DO 0');
PREPARE s FROM @s; EXECUTE s; DEALLOCATE PREPARE s;

SET @c2 := (SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_activity' AND INDEX_NAME = 'idx_activity_event');
SET @s2 := IF(@c2 = 0, 'ALTER TABLE application_activity ADD INDEX idx_activity_event (event)', 'DO 0');
PREPARE s2 FROM @s2; EXECUTE s2; DEALLOCATE PREPARE s2;

UPDATE application_activity SET event = 'message'
 WHERE event IS NULL AND type = 'message';

UPDATE application_activity SET event = 'doc_rejected'
 WHERE event IS NULL AND (body LIKE '%Needs Re-upload%' OR body LIKE '%sent back:%');

UPDATE application_activity SET event = 'doc_intake'
 WHERE event IS NULL AND body LIKE '%passed intake%';

UPDATE application_activity SET event = 'doc_verified'
 WHERE event IS NULL AND body LIKE '%marked as Verified%';

UPDATE application_activity SET event = 'submitted'
 WHERE event IS NULL AND body LIKE '%submitted%';

UPDATE application_activity SET event = 'approved'
 WHERE event IS NULL AND (body LIKE '%to "Approved"%' OR body LIKE '%to Approved%' OR body LIKE '%Approved by%');

UPDATE application_activity SET event = 'rejected'
 WHERE event IS NULL AND (body LIKE '%to "Rejected"%' OR body LIKE '%to Rejected%' OR body LIKE '%Rejected by%');

UPDATE application_activity SET event = 'status'
 WHERE event IS NULL AND type = 'status_change';
