-- 001: User levels (Normal User / Resident / Business Owner / City Staff / Admin)
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/001_user_levels.sql
--
-- Model:
--   role = 'applicant'  -> public account ("Normal User")
--        + resident_status = 'verified'        -> also a Resident
--        + a verified business (later phase)   -> also a Business Owner
--   role = 'staff'      -> City Staff
--   role = 'admin'      -> Admin (superadmin; can do everything staff can)

USE permittrack;

ALTER TABLE users
    MODIFY role ENUM('applicant', 'staff', 'admin') NOT NULL DEFAULT 'applicant',
    MODIFY email VARCHAR(190) NULL,
    ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NULL AFTER email,
    ADD COLUMN IF NOT EXISTS first_name VARCHAR(80) NULL AFTER full_name,
    ADD COLUMN IF NOT EXISTS middle_name VARCHAR(80) NULL AFTER first_name,
    ADD COLUMN IF NOT EXISTS last_name VARCHAR(80) NULL AFTER middle_name,
    ADD COLUMN IF NOT EXISTS birthdate DATE NULL AFTER last_name,
    ADD COLUMN IF NOT EXISTS address_line VARCHAR(190) NULL AFTER birthdate,
    ADD COLUMN IF NOT EXISTS barangay VARCHAR(100) NULL AFTER address_line,
    ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL AFTER barangay,
    ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10) NULL AFTER city,
    ADD COLUMN IF NOT EXISTS email_verified_at DATETIME NULL AFTER postal_code,
    ADD COLUMN IF NOT EXISTS phone_verified_at DATETIME NULL AFTER email_verified_at,
    ADD COLUMN IF NOT EXISTS privacy_consent_at DATETIME NULL AFTER phone_verified_at,
    ADD COLUMN IF NOT EXISTS resident_status ENUM('none', 'pending', 'verified', 'rejected') NOT NULL DEFAULT 'none' AFTER privacy_consent_at;

-- MariaDB allows many NULLs in a UNIQUE index, so email-only and phone-only accounts both work
ALTER TABLE users ADD UNIQUE INDEX IF NOT EXISTS uq_users_phone (phone);

-- One-time codes for verifying an email address or phone number
CREATE TABLE IF NOT EXISTS verification_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    channel ENUM('email', 'sms') NOT NULL,
    destination VARCHAR(190) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    attempts TINYINT NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_codes_user_channel (user_id, channel),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Existing accounts: keep their logins working
UPDATE users
SET first_name = SUBSTRING_INDEX(full_name, ' ', 1),
    last_name = NULLIF(TRIM(SUBSTRING(full_name, LENGTH(SUBSTRING_INDEX(full_name, ' ', 1)) + 1)), '')
WHERE first_name IS NULL;

UPDATE users SET email_verified_at = created_at WHERE email IS NOT NULL AND email_verified_at IS NULL;
UPDATE users SET onboarding_completed = 1;

-- Default Admin account (password: Password123!)
INSERT IGNORE INTO users (role, account_type, email, password_hash, full_name, first_name, last_name, onboarding_completed, email_verified_at)
VALUES ('admin', 'resident', 'admin@hotmail.com', '$2y$10$iAOFhZfOfGXxtsd7v1Yfq.WUecXK4YGQNc3q0MdezaqRR.QpZnesG', 'System Administrator', 'System', 'Administrator', 1, NOW());
