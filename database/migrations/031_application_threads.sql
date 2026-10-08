-- ---------------------------------------------------------------------------
-- 031 — Every application has its thread in Messages
--
-- Messages about a filed application used to live on the permit page, under "Activity &
-- Messages", where staff never saw them: nothing on the staff side read them. Now each
-- application has one conversation (conversations.application_id), shown in the chat panel's
-- Messages tab and in the Staff Portal's Messages inbox like any other thread.
--
-- The application's own timeline stays where it was. application_activity still holds both its
-- status lines and its messages (the notification bell reads it, and nothing is copied), so an
-- application thread shows that timeline: status lines as small notes, messages as bubbles. The
-- conversation row holds what a thread needs on top — whose turn it is and each side's read mark.
--
-- department_id is the office that issues the permit (its last pipeline step), as for any thread;
-- every office on the application's pipeline can read and answer it (api/lib/threads.php).
-- Re-running this file changes nothing.
-- ---------------------------------------------------------------------------

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS application_id INT NULL AFTER permit_type_id;
ALTER TABLE conversations ADD UNIQUE INDEX IF NOT EXISTS uq_conv_application (application_id);

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'conversations' AND CONSTRAINT_NAME = 'fk_conv_application');
SET @sql := IF(@fk = 0,
  'ALTER TABLE conversations ADD CONSTRAINT fk_conv_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- A thread for every application already filed. Messages already on them come along: the last
-- one decides whose turn it is, and the offices see the applicant's as unread — they never had a
-- way to read them before. The applicant has read everything up to now.
INSERT INTO conversations
    (user_id, department_id, permit_type_id, application_id, subject, last_message_at, last_sender_id, user_read_at, created_at)
SELECT a.applicant_id,
       (SELECT p.department_id FROM application_pipeline_progress p
         WHERE p.application_id = a.id ORDER BY p.step_order DESC, p.id DESC LIMIT 1),
       a.permit_type_id,
       a.id,
       LEFT(COALESCE(pt.name, a.permit_type, 'Permit application'), 150),
       -- never later than now, so a clock that runs behind the data can't leave it unread forever
       LEAST(NOW(3), COALESCE((SELECT MAX(m.created_at) FROM application_activity m
                  WHERE m.application_id = a.id AND m.type = 'message'), a.created_at)),
       (SELECT m.sender_id FROM application_activity m
         WHERE m.application_id = a.id AND m.type = 'message' ORDER BY m.id DESC LIMIT 1),
       NOW(3),
       a.created_at
  FROM applications a
  LEFT JOIN permit_types pt ON pt.id = a.permit_type_id
 WHERE NOT EXISTS (SELECT 1 FROM conversations c WHERE c.application_id = a.id)
   AND EXISTS (SELECT 1 FROM application_pipeline_progress p WHERE p.application_id = a.id);
