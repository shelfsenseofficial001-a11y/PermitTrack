-- 003: Business upgrade. A user can register several businesses; each is verified by City Staff.
-- Any approved business gives the account the "Business Owner" label.
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/003_businesses.sql

USE permittrack;

CREATE TABLE IF NOT EXISTS businesses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    -- draft: saved but not submitted (e.g. imported from the old business onboarding)
    status ENUM('draft', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    business_name VARCHAR(190) NOT NULL,
    trade_name VARCHAR(190) NULL,
    ownership_type ENUM('sole_proprietorship', 'partnership', 'corporation', 'cooperative') NULL,
    line_of_business VARCHAR(100) NULL,
    registration_number VARCHAR(60) NULL,   -- DTI / SEC / CDA number
    tin VARCHAR(20) NULL,
    address_line VARCHAR(190) NULL,
    barangay VARCHAR(100) NULL,
    city VARCHAR(100) NULL,
    postal_code VARCHAR(10) NULL,
    business_email VARCHAR(190) NULL,
    business_phone VARCHAR(20) NULL,
    floor_area_sqm DECIMAL(10,2) NULL,
    employee_count INT NULL,
    is_registered_owner TINYINT(1) NOT NULL DEFAULT 1,  -- is the account holder the owner named on the registration?
    representative_role VARCHAR(80) NULL,                 -- e.g. "President", "Authorized representative"
    declared_at DATETIME NULL,
    submitted_at DATETIME NULL,
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    rejection_reason VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_business_status (status, submitted_at),
    INDEX idx_business_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- One file per required document slot (doc_key); replacing a document overwrites its row
CREATE TABLE IF NOT EXISTS business_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_id INT NOT NULL,
    doc_key VARCHAR(40) NOT NULL,        -- registration | representative_id | barangay_clearance | location_proof | authority
    id_type VARCHAR(40) NULL,            -- for representative_id: which government ID
    file_path VARCHAR(255) NOT NULL,     -- relative to storage/, never web-accessible
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INT NOT NULL,
    uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_business_doc (business_id, doc_key),
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Business permits are filed for a specific verified business
ALTER TABLE applications ADD COLUMN IF NOT EXISTS business_id INT NULL AFTER applicant_id;
ALTER TABLE applications ADD INDEX IF NOT EXISTS idx_app_business (business_id);
-- (FK added separately so re-running doesn't fail on a duplicate constraint)
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
                  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND CONSTRAINT_NAME = 'fk_app_business');
SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE applications ADD CONSTRAINT fk_app_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Carry over profiles from the old business onboarding as drafts the owner can finish and submit
INSERT INTO businesses (user_id, status, business_name, tin, business_phone, address_line)
SELECT bp.user_id, 'draft', bp.business_name, bp.ein, bp.phone, bp.address
FROM business_profiles bp
WHERE NOT EXISTS (SELECT 1 FROM businesses b WHERE b.user_id = bp.user_id AND b.business_name = bp.business_name);
