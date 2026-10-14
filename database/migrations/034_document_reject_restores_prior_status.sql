-- ---------------------------------------------------------------------------
-- 034 — Undoing a rejection restores whatever the document was before it
--
-- Rejecting an already-Verified document sent it back to 'Needs Re-upload' same as
-- rejecting one still at 'Intake Approved' or 'Pending Review'. Undoing either kind of
-- rejection then landed on the same place — one step before the owning office's own
-- decision — which meant un-rejecting a document that was already approved made it go
-- through approval again instead of simply being approved again.
--
-- pre_reject_status now records the status a document held the moment it was rejected,
-- so undo can put it back exactly where it was — Verified included — instead of always
-- stepping back to the pre-approval stage. It is cleared whenever a document leaves
-- 'Needs Re-upload', the same as reject_reason and the other rejection columns.
--
-- Idempotent: the column is added only if absent.
-- ---------------------------------------------------------------------------

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_documents' AND COLUMN_NAME = 'pre_reject_status');
SET @s := IF(@c = 0, 'ALTER TABLE application_documents ADD COLUMN pre_reject_status VARCHAR(20) NULL AFTER rejected_at', 'DO 0');
PREPARE s FROM @s; EXECUTE s; DEALLOCATE PREPARE s;

-- Anything not actually rejected must not carry a prior status either.
UPDATE application_documents
   SET pre_reject_status = NULL
 WHERE status <> 'Needs Re-upload' AND pre_reject_status IS NOT NULL;
