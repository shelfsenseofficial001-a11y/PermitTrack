-- ---------------------------------------------------------------------------
-- 031 — Documents are checked twice: barangay intake, then the owning office
--
-- The barangay is step one. The secretary opens every submitted file and checks it is present,
-- readable and actually the document it claims to be, and only then does the permit — and its
-- paperwork — reach the city offices. The office that owns a document still makes the real
-- decision on what it says; intake is a completeness check, not a ruling.
--
-- So a document now moves:
--
--   Pending Review --(barangay intake)--> Intake Approved --(owning office)--> Verified
--          \                                      /
--           \----------- Needs Re-upload <-------/     (either stage can send it back)
--
-- 'Intake Approved' is added between the two existing states rather than kept in a second column,
-- because a document really is at exactly one point in that line, and every existing query that
-- asks "is this Verified yet" keeps the right answer without being touched.
--
-- intake_by / intake_at record who did the intake pass, the same way the pipeline records who
-- signed off each step. A government file should say who passed it on.
--
-- Backfill: applications whose barangay step has already been signed off have, by definition,
-- been through intake, so their still-unreviewed documents move to 'Intake Approved'. Documents
-- already Verified, Missing or awaiting re-upload are left exactly as they are.
--
-- Idempotent: the enum is only widened if 'Intake Approved' is absent, columns are added only if
-- absent, and the backfill only touches rows still sitting at 'Pending Review'.
-- ---------------------------------------------------------------------------

SET @e := (SELECT COLUMN_TYPE FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_documents' AND COLUMN_NAME = 'status');
SET @s := IF(@e NOT LIKE '%Intake Approved%',
  "ALTER TABLE application_documents MODIFY COLUMN status
     ENUM('Missing','Pending Review','Intake Approved','Verified','Needs Re-upload') NOT NULL DEFAULT 'Missing'",
  'DO 0');
PREPARE s FROM @s; EXECUTE s; DEALLOCATE PREPARE s;

SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_documents' AND COLUMN_NAME = 'intake_by');
SET @s1 := IF(@c1 = 0, 'ALTER TABLE application_documents ADD COLUMN intake_by INT NULL AFTER status', 'DO 0');
PREPARE s1 FROM @s1; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @c2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_documents' AND COLUMN_NAME = 'intake_at');
SET @s2 := IF(@c2 = 0, 'ALTER TABLE application_documents ADD COLUMN intake_at DATETIME NULL AFTER intake_by', 'DO 0');
PREPARE s2 FROM @s2; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @c3 := (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_documents' AND CONSTRAINT_NAME = 'fk_doc_intake_by');
SET @s3 := IF(@c3 = 0,
  'ALTER TABLE application_documents ADD CONSTRAINT fk_doc_intake_by FOREIGN KEY (intake_by) REFERENCES users(id) ON DELETE SET NULL',
  'DO 0');
PREPARE s3 FROM @s3; EXECUTE s3; DEALLOCATE PREPARE s3;

-- Already past intake: the barangay step is decided, so the paperwork went through it.
UPDATE application_documents d
   JOIN application_pipeline_progress p
     ON p.application_id = d.application_id AND p.office_code = 'BARANGAY'
    SET d.status = 'Intake Approved'
  WHERE d.status = 'Pending Review'
    AND p.status IN ('approved', 'rejected', 'skipped');
