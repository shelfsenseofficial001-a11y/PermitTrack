-- ---------------------------------------------------------------------------
-- 032 — A rejected document says why
--
-- Sending a document back told the applicant only "Needs Update — see reviewer note", which meant
-- hunting through the activity feed for a sentence someone may or may not have written. The reason
-- is now recorded on the document itself: a reason picked from a fixed list, so it is consistent
-- and can be shown plainly, plus optional notes for anything the list does not cover.
--
-- The reason is a short code ('unreadable', 'wrong_document', …), not the wording shown on screen —
-- see DOCUMENT_REJECT_REASONS in api/config.php. Storing the code means the wording can be
-- reworded, or translated, without rewriting rows.
--
-- The four columns are cleared whenever a document moves off 'Needs Re-upload': re-uploaded by the
-- applicant, approved, or the rejection undone. A stale reason on a document that is no longer
-- rejected would be worse than none.
--
-- Idempotent: every column and key is added only if absent.
-- ---------------------------------------------------------------------------

SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_documents' AND COLUMN_NAME = 'reject_reason');
SET @s1 := IF(@c1 = 0, 'ALTER TABLE application_documents ADD COLUMN reject_reason VARCHAR(40) NULL AFTER status', 'DO 0');
PREPARE s1 FROM @s1; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @c2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_documents' AND COLUMN_NAME = 'reject_notes');
SET @s2 := IF(@c2 = 0, 'ALTER TABLE application_documents ADD COLUMN reject_notes VARCHAR(500) NULL AFTER reject_reason', 'DO 0');
PREPARE s2 FROM @s2; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @c3 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_documents' AND COLUMN_NAME = 'rejected_by');
SET @s3 := IF(@c3 = 0, 'ALTER TABLE application_documents ADD COLUMN rejected_by INT NULL AFTER reject_notes', 'DO 0');
PREPARE s3 FROM @s3; EXECUTE s3; DEALLOCATE PREPARE s3;

SET @c4 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_documents' AND COLUMN_NAME = 'rejected_at');
SET @s4 := IF(@c4 = 0, 'ALTER TABLE application_documents ADD COLUMN rejected_at DATETIME NULL AFTER rejected_by', 'DO 0');
PREPARE s4 FROM @s4; EXECUTE s4; DEALLOCATE PREPARE s4;

SET @c5 := (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_documents' AND CONSTRAINT_NAME = 'fk_doc_rejected_by');
SET @s5 := IF(@c5 = 0,
  'ALTER TABLE application_documents ADD CONSTRAINT fk_doc_rejected_by FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL',
  'DO 0');
PREPARE s5 FROM @s5; EXECUTE s5; DEALLOCATE PREPARE s5;

-- Anything not actually rejected must not carry a reason.
UPDATE application_documents
   SET reject_reason = NULL, reject_notes = NULL, rejected_by = NULL, rejected_at = NULL
 WHERE status <> 'Needs Re-upload'
   AND (reject_reason IS NOT NULL OR reject_notes IS NOT NULL OR rejected_by IS NOT NULL OR rejected_at IS NOT NULL);
