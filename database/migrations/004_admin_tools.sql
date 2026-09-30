-- 004: Admin tools — departments, staff account management, account status
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/004_admin_tools.sql

USE permittrack;

-- A department handles certain permit types; its staff see only those in their review queue.
CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    code VARCHAR(20) NOT NULL,
    description VARCHAR(255) NULL,
    permit_types VARCHAR(255) NOT NULL DEFAULT '',   -- comma-separated permit types this department reviews
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_department_code (code)
) ENGINE=InnoDB;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS department_id INT NULL AFTER role,
    ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER department_id,
    ADD COLUMN IF NOT EXISTS must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash,
    ADD COLUMN IF NOT EXISTS last_login_at DATETIME NULL AFTER created_at;

SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
                  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_user_department');
SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE users ADD CONSTRAINT fk_user_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Starting departments (Admins can rename them and change which permits they handle)
INSERT IGNORE INTO departments (name, code, description, permit_types) VALUES
    ('Office of the Building Official', 'OBO', 'Building, renovation and signage permits', 'Building/Renovation,Sign'),
    ('Business Permits and Licensing Office', 'BPLO', 'Business licenses and special events', 'Business License,Special Event'),
    ('City Health Office', 'CHO', 'Food service and sanitary permits', 'Food Service');
