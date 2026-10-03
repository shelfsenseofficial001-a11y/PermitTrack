-- ---------------------------------------------------------------------------
-- 025 — The barangay a permit is actually for
--
-- Routing took the barangay from the applicant's own record: where they live,
-- or where their business is registered. For a permit about a place that is
-- fine until the place is somewhere else — building on a lot in Salitran II
-- while living in Burol I sent the application to Burol I's secretariat, which
-- has no standing over that lot.
--
-- The barangay is now part of the application, chosen alongside the address it
-- belongs to. Permits with no address (a Certificate of Residency, a personal
-- barangay clearance) are unaffected: those are about the person, so they keep
-- routing to the barangay the applicant is registered in.
--
-- Backfill reads each application's own route rather than re-deriving from the
-- applicant, because the route is the snapshot that was actually used — if an
-- applicant has moved since filing, the route still names the office that
-- really handled it.
--
-- Idempotent: the column is added only if absent, and the backfill only fills
-- rows that are still NULL.
-- ---------------------------------------------------------------------------

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'barangay_id');
SET @sql := IF(@col = 0,
    'ALTER TABLE applications ADD COLUMN barangay_id INT NULL AFTER property_address',
    'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND INDEX_NAME = 'idx_applications_barangay');
SET @sql2 := IF(@idx = 0,
    'CREATE INDEX idx_applications_barangay ON applications (barangay_id)',
    'DO 0');
PREPARE s2 FROM @sql2; EXECUTE s2; DEALLOCATE PREPARE s2;

-- Existing applications: take the barangay from the barangay office on their own route.
UPDATE applications a
  JOIN application_pipeline_progress p ON p.application_id = a.id
  JOIN departments d ON d.id = p.department_id AND d.barangay_id IS NOT NULL
   SET a.barangay_id = d.barangay_id
 WHERE a.barangay_id IS NULL;

-- Anything with no barangay node at all (an Occupancy Permit starts at the Building
-- Official) falls back to where the applicant is registered.
UPDATE applications a
  JOIN users u ON u.id = a.applicant_id
   SET a.barangay_id = u.barangay_id
 WHERE a.barangay_id IS NULL AND u.barangay_id IS NOT NULL;
