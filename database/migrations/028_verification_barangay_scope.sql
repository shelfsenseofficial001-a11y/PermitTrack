-- ---------------------------------------------------------------------------
-- 028 — A residency request belongs to one barangay
--
-- resident_verifications recorded the barangay as free text only, so nothing could tell which
-- secretariat a request was for. Every barangay secretary could list, open and decide every other
-- barangay's residency requests. business.php already stores barangay_id; this brings residency in
-- line, so each request can be scoped to the secretariat that handles it.
--
-- Backfill matches the stored name against the barangays table. Anything that does not match
-- (a name typed before the list existed) stays NULL and is visible only to Admin until someone
-- reviews it - the safe default for an unknown owner.
--
-- Idempotent.
-- ---------------------------------------------------------------------------

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resident_verifications' AND COLUMN_NAME = 'barangay_id');
SET @s := IF(@c = 0, 'ALTER TABLE resident_verifications ADD COLUMN barangay_id INT NULL AFTER city', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resident_verifications' AND INDEX_NAME = 'idx_rv_barangay');
SET @si := IF(@i = 0, 'CREATE INDEX idx_rv_barangay ON resident_verifications (barangay_id)', 'DO 0');
PREPARE sti FROM @si; EXECUTE sti; DEALLOCATE PREPARE sti;

UPDATE resident_verifications rv
  JOIN barangays b ON LOWER(b.name) = LOWER(rv.barangay)
   SET rv.barangay_id = b.id
 WHERE rv.barangay_id IS NULL;
