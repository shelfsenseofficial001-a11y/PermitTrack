-- ---------------------------------------------------------------------------
-- 036 — Replying to, editing and removing a message
--
-- A message lives in one of two tables: conversation_messages (a question sent from the chat
-- panel) or application_activity (the timeline of a filed application, where messages sit between
-- the status lines). Both get the same four columns, and both are read by api/conversations.php.
--
--   reply_to_id    the message this one answers, in the same thread. Not a foreign key: it is
--                  checked on write, and a message is never hard-deleted, so it cannot dangle.
--   edited_at      set the first time the sender changes the text, and moved on every edit after.
--   original_body  what the message said before its first edit — kept so "edited" can be opened to
--                  show it. Never overwritten by later edits: it is the first version, not the last.
--   deleted_at     the sender removed it. The row stays, so replies to it and the order of the thread
--                  still make sense; body is emptied and original_body cleared, so nothing of what it
--                  said survives. Readers show "Message removed".
--
-- Re-running this file changes nothing.
-- ---------------------------------------------------------------------------

ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS reply_to_id INT NULL AFTER body;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS edited_at DATETIME(3) NULL AFTER reply_to_id;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS original_body TEXT NULL AFTER edited_at;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS deleted_at DATETIME(3) NULL AFTER original_body;

ALTER TABLE application_activity ADD COLUMN IF NOT EXISTS reply_to_id INT NULL AFTER body;
ALTER TABLE application_activity ADD COLUMN IF NOT EXISTS edited_at DATETIME(3) NULL AFTER reply_to_id;
ALTER TABLE application_activity ADD COLUMN IF NOT EXISTS original_body TEXT NULL AFTER edited_at;
ALTER TABLE application_activity ADD COLUMN IF NOT EXISTS deleted_at DATETIME(3) NULL AFTER original_body;
