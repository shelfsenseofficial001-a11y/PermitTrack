-- ---------------------------------------------------------------------------
-- 038 — View-before-deciding, per-file revise, document versions, node freeze,
--        and two new quick questions (senior citizen / first-time jobseeker)
--
-- Four related changes, all additive:
--
-- 1. A staff account must open AND download a document (per version) before acting on it.
--    document_access_log records that, per (document, version, staff member).
--
-- 2. A rejected/"needs revision" file keeps every prior upload: application_document_versions
--    archives whatever was in application_documents the moment a new file supersedes it.
--    application_documents.version is the live/current version number.
--
-- 3. 'Needs Re-upload' now carries a decision_type ('rejected' vs 'revision') so the two
--    outcomes mockup 3's reason picker can produce are told apart in the UI, even though both
--    still send the file back to the applicant the same way.
--
-- 4. When the office that OWNS a document (not just the barangay doing intake) rejects it or
--    asks for a revision, the application's current pipeline node freezes until a revised
--    version is uploaded and re-approved. frozen_at/frozen_by/freeze_reason/freeze_kind record
--    that, and also cover a reviewer freezing a node directly (no document decision needed).
--
-- 5. permit_type_conditions holds pure data-collection quick questions (no pipeline routing
--    implication) — Are you a senior citizen? / Are you a first-time job seeker? — kept
--    separate from permit_pipeline_steps' branch questions, which always add an office to
--    the route. Seeded for every current permit type.
--
-- Idempotent throughout: every ALTER is guarded by information_schema, every CREATE uses
-- IF NOT EXISTS, every seed INSERT is a SELECT ... WHERE NOT EXISTS.
-- ---------------------------------------------------------------------------

-- application_documents: version + decision_type -----------------------------------------------
SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_documents' AND COLUMN_NAME = 'version');
SET @s1 := IF(@c1 = 0, 'ALTER TABLE application_documents ADD COLUMN version INT NOT NULL DEFAULT 1 AFTER id', 'DO 0');
PREPARE s1 FROM @s1; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @c2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_documents' AND COLUMN_NAME = 'decision_type');
SET @s2 := IF(@c2 = 0,
  "ALTER TABLE application_documents ADD COLUMN decision_type ENUM('rejected','revision') NULL AFTER reject_notes",
  'DO 0');
PREPARE s2 FROM @s2; EXECUTE s2; DEALLOCATE PREPARE s2;

-- Any document already sitting at 'Needs Re-upload' predates this distinction — tag it as a
-- revision request, the more common historical case (vs. an outright reject).
UPDATE application_documents SET decision_type = 'revision'
 WHERE status = 'Needs Re-upload' AND decision_type IS NULL;

-- application_document_versions: archive of superseded uploads ---------------------------------
CREATE TABLE IF NOT EXISTS application_document_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    version INT NOT NULL,
    file_path VARCHAR(255) NULL,
    original_filename VARCHAR(255) NULL,
    uploaded_at DATETIME NULL,
    status VARCHAR(20) NULL,
    reject_reason VARCHAR(40) NULL,
    reject_notes VARCHAR(500) NULL,
    decision_type ENUM('rejected','revision') NULL,
    decided_by INT NULL,
    decided_at DATETIME NULL,
    archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_doc_versions_document (document_id, version),
    CONSTRAINT fk_doc_version_document FOREIGN KEY (document_id) REFERENCES application_documents(id) ON DELETE CASCADE,
    CONSTRAINT fk_doc_version_decided_by FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- document_access_log: per staff member, per document version --------------------------------
CREATE TABLE IF NOT EXISTS document_access_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    user_id INT NOT NULL,
    viewed_at DATETIME NULL,
    downloaded_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_doc_access (document_id, version, user_id),
    CONSTRAINT fk_doc_access_document FOREIGN KEY (document_id) REFERENCES application_documents(id) ON DELETE CASCADE,
    CONSTRAINT fk_doc_access_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- application_pipeline_progress: node freeze ---------------------------------------------------
SET @c3 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_pipeline_progress' AND COLUMN_NAME = 'frozen_at');
SET @s3 := IF(@c3 = 0, 'ALTER TABLE application_pipeline_progress ADD COLUMN frozen_at DATETIME NULL AFTER notes', 'DO 0');
PREPARE s3 FROM @s3; EXECUTE s3; DEALLOCATE PREPARE s3;

SET @c4 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_pipeline_progress' AND COLUMN_NAME = 'frozen_by');
SET @s4 := IF(@c4 = 0, 'ALTER TABLE application_pipeline_progress ADD COLUMN frozen_by INT NULL AFTER frozen_at', 'DO 0');
PREPARE s4 FROM @s4; EXECUTE s4; DEALLOCATE PREPARE s4;

SET @c5 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_pipeline_progress' AND COLUMN_NAME = 'freeze_reason');
SET @s5 := IF(@c5 = 0, 'ALTER TABLE application_pipeline_progress ADD COLUMN freeze_reason VARCHAR(500) NULL AFTER frozen_by', 'DO 0');
PREPARE s5 FROM @s5; EXECUTE s5; DEALLOCATE PREPARE s5;

SET @c6 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_pipeline_progress' AND COLUMN_NAME = 'freeze_kind');
SET @s6 := IF(@c6 = 0,
  "ALTER TABLE application_pipeline_progress ADD COLUMN freeze_kind ENUM('freeze','revision') NULL AFTER freeze_reason",
  'DO 0');
PREPARE s6 FROM @s6; EXECUTE s6; DEALLOCATE PREPARE s6;

SET @c7 := (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_pipeline_progress' AND CONSTRAINT_NAME = 'fk_pipeline_frozen_by');
SET @s7 := IF(@c7 = 0,
  'ALTER TABLE application_pipeline_progress ADD CONSTRAINT fk_pipeline_frozen_by FOREIGN KEY (frozen_by) REFERENCES users(id) ON DELETE SET NULL',
  'DO 0');
PREPARE s7 FROM @s7; EXECUTE s7; DEALLOCATE PREPARE s7;

-- permit_type_conditions: pure data-collection quick questions ---------------------------------
CREATE TABLE IF NOT EXISTS permit_type_conditions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    permit_type_id INT NOT NULL,
    condition_key VARCHAR(60) NOT NULL,
    question_label VARCHAR(255) NOT NULL,
    yes_label VARCHAR(60) NOT NULL DEFAULT 'Yes',
    no_label VARCHAR(60) NOT NULL DEFAULT 'No',
    requires_document VARCHAR(190) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_permit_type_condition (permit_type_id, condition_key),
    CONSTRAINT fk_permit_type_condition FOREIGN KEY (permit_type_id) REFERENCES permit_types(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Senior citizen: every permit type that charges a fee — i.e. every type except the one permit
-- that is itself free (First-Time Jobseeker Certificate; see api/lib/business.php FEE_SCHEDULE).
-- "Yes" asks for a Senior Citizen ID and, at submission, trims 20% off the fee.
INSERT INTO permit_type_conditions (permit_type_id, condition_key, question_label, yes_label, no_label, requires_document, sort_order)
SELECT pt.id, 'senior_citizen', 'Are you a senior citizen?', 'Yes', 'No', 'Senior Citizen ID', 0
  FROM permit_types pt
 WHERE pt.name <> 'First-Time Jobseeker Certificate'
   AND NOT EXISTS (
       SELECT 1 FROM permit_type_conditions c WHERE c.permit_type_id = pt.id AND c.condition_key = 'senior_citizen'
   );

-- First-time job seeker: only the four permit types named in the spec. "Yes" makes the permit free.
INSERT INTO permit_type_conditions (permit_type_id, condition_key, question_label, yes_label, no_label, requires_document, sort_order)
SELECT pt.id, 'first_time_jobseeker', 'Are you a first-time job seeker?', 'Yes', 'No', NULL, 1
  FROM permit_types pt
 WHERE pt.name IN ('Barangay Clearance (Personal)', 'Barangay Employment Clearance',
                    'Certificate of Good Moral Character', 'Certificate of Residency')
   AND NOT EXISTS (
       SELECT 1 FROM permit_type_conditions c WHERE c.permit_type_id = pt.id AND c.condition_key = 'first_time_jobseeker'
   );
