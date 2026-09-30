-- 002: Resident upgrade (two proofs of residence, reviewed by City Staff) + audit log
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/002_resident_verification.sql

USE permittrack;

-- One row per submission. A rejected request stays for history; resubmitting creates a new row.
CREATE TABLE IF NOT EXISTS resident_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    -- Address as it was when submitted, so staff compare the proofs against what the user claimed
    address_line VARCHAR(190) NOT NULL,
    barangay VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    declared_at DATETIME NOT NULL,
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    rejection_reason VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_resver_status (status, created_at),
    INDEX idx_resver_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS resident_proofs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    verification_id INT NOT NULL,
    doc_type VARCHAR(40) NOT NULL,
    issued_on DATE NULL,
    file_path VARCHAR(255) NOT NULL,       -- relative to storage/, never web-accessible
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INT NOT NULL,
    uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (verification_id) REFERENCES resident_verifications(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Who did what, for approvals and other sensitive actions
CREATE TABLE IF NOT EXISTS audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    actor_id INT NULL,
    action VARCHAR(60) NOT NULL,
    subject_type VARCHAR(40) NOT NULL,
    subject_id INT NOT NULL,
    details VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_subject (subject_type, subject_id),
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
