-- ---------------------------------------------------------------------------
-- 041 -- Report User (section 4, mockup 4): user_reports
--
-- A staff member reviewing an application can flag the applicant for something outside the
-- paperwork itself -- not a document rejection (that already exists, documents.php), but
-- behaviour: NSFW uploads, forged documents, fake payment proof, malicious attachments, spam
-- filing, identity theft, scope/ownership misrepresentation. Always tied to the application
-- being reviewed (so the reported user is never ambiguous); the specific document is optional,
-- since not every category points at one file.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reported_user_id INT NOT NULL,
    reported_by INT NOT NULL,
    category VARCHAR(60) NOT NULL,
    description TEXT NOT NULL,
    application_id INT NULL,
    document_id INT NULL,
    status ENUM('open','actioned','dismissed') NOT NULL DEFAULT 'open',
    resolved_by INT NULL,
    resolved_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_user_reports_reported_user (reported_user_id),
    KEY idx_user_reports_status (status),
    CONSTRAINT fk_user_report_reported_user FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_report_reported_by FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_report_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL,
    CONSTRAINT fk_user_report_document FOREIGN KEY (document_id) REFERENCES application_documents(id) ON DELETE SET NULL,
    CONSTRAINT fk_user_report_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
