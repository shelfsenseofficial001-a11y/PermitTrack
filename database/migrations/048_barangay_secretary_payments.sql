-- ---------------------------------------------------------------------------
-- 048 -- Route barangay level permit payments to Barangay Secretary Account & record payment messages
--
-- Remove Municipal Treasury / separate payments department involvement from
-- barangay-level permits (personal and barangay_standalone tracks).
-- Payment for barangay-level permits goes directly to the Barangay Secretary Account
-- (departments where code LIKE 'BRGY-%' and purpose = 'review').
-- Municipal Treasury involvement is preserved for municipal-level permits (TREASURY_PAY).
-- Also records payment confirmation messages in application_activity.
-- ---------------------------------------------------------------------------

-- Update any payments for barangay-level permits to point to the Barangay Secretariat department
UPDATE payments p
JOIN applications a ON a.id = p.application_id
JOIN permit_types pt ON pt.id = a.permit_type_id
JOIN departments target_dept ON target_dept.barangay_id = a.barangay_id
  AND target_dept.code LIKE 'BRGY-%'
  AND target_dept.code NOT LIKE 'BRGY-PAY-%'
SET p.recipient_department_id = target_dept.id
WHERE pt.track IN ('personal', 'barangay_standalone')
  AND a.barangay_id IS NOT NULL;

-- Backfill payment received activity messages for pending payments with a reference
INSERT INTO application_activity (application_id, sender_id, type, event, body, created_at)
SELECT p.application_id, a.applicant_id, 'status_change', 'payment',
       CONCAT('Payment of ₱', FORMAT(p.amount, 2), ' received via ',
              CASE p.method WHEN 'gcash' THEN 'GCash' WHEN 'maya' THEN 'Maya' ELSE 'Bank Transfer' END,
              IF(p.reference IS NOT NULL AND p.reference != '', CONCAT(' (ref ', p.reference, ')'), ''),
              '. Waiting for office confirmation.'),
       p.updated_at
  FROM payments p
  JOIN applications a ON a.id = p.application_id
 WHERE p.status = 'pending' AND p.reference IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM application_activity act
        WHERE act.application_id = p.application_id AND act.event = 'payment'
   );

-- Backfill payment confirmed activity messages for succeeded payments
INSERT INTO application_activity (application_id, sender_id, type, event, body, created_at)
SELECT p.application_id, COALESCE(p.confirmed_by, a.applicant_id), 'status_change', 'payment',
       CONCAT('Payment of ₱', FORMAT(p.amount, 2), ' confirmed received. Application is now in the review pipeline.'),
       COALESCE(p.confirmed_at, p.updated_at)
  FROM payments p
  JOIN applications a ON a.id = p.application_id
 WHERE p.status = 'succeeded'
   AND NOT EXISTS (
       SELECT 1 FROM application_activity act
        WHERE act.application_id = p.application_id AND act.event = 'payment'
   );
