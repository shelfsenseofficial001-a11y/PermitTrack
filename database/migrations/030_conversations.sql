-- ---------------------------------------------------------------------------
-- 030 — Conversations: an applicant writing to the office that issues a permit
--
-- Messages so far only existed on an application (application_activity), so a question had to
-- wait until there was something filed to hang it on. A conversation is the question before that:
-- an applicant picks the permit they are asking about, and it lands with the office that issues
-- it — the office of that permit's last pipeline step, or the applicant's own barangay
-- secretariat when the last step is BARANGAY. See api/conversations.php.
--
-- The office is stored rather than worked out each time, so a conversation stays with the office
-- it was sent to even if the pipeline is re-routed later. The permit is kept for the subject line
-- and nulled, not cascaded, if the permit type is ever removed.
--
-- Read state is a timestamp per side — enough for one applicant and one office per thread, with
-- no per-message receipts to keep in step. The timestamps carry milliseconds: at whole seconds, a
-- reply landing in the same second the thread was opened compares equal to the read mark and is
-- never shown as unread. last_sender_id says whose turn it is, so your own message is never
-- unread to you. Re-running this file changes nothing.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,                 -- the applicant who started it
    department_id INT NOT NULL,           -- the office it was routed to
    permit_type_id INT NULL,              -- what they are asking about
    subject VARCHAR(150) NOT NULL,
    status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
    last_message_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    last_sender_id INT NULL,
    user_read_at DATETIME(3) NULL,        -- the applicant has seen everything up to here
    staff_read_at DATETIME(3) NULL,       -- the office has seen everything up to here
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_conv_user (user_id, last_message_at),
    INDEX idx_conv_department (department_id, status, last_message_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (permit_type_id) REFERENCES permit_types(id) ON DELETE SET NULL,
    FOREIGN KEY (last_sender_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_id INT NULL,                   -- NULL once the sender's account is deleted
    body TEXT NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX idx_convmsg_thread (conversation_id, created_at),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
