-- 008: Barangay reference data + multi-office permit pipeline (schema only).
--
-- Scope: this migration adds the tables/columns needed for the branching,
-- per-office permit pipeline (see the "PermitTrack — Staff Levels & Permit
-- Scope Spec" doc). It does NOT touch application behavior yet:
--   - api/*.php and assets/js/* still run on the existing single `permit_type`
--     enum and the existing department/reviewer-queue logic.
--   - `applications.permit_type_id` and the pipeline tables are additive and
--     unused by the app until that follow-up wiring lands.
--   - Every new department this migration creates (the 75 barangay
--     secretariats + the new city offices) is seeded with permit_types =
--     '__unassigned__', a value that matches no real permit type. Under the
--     CURRENT reviewer.php logic, an EMPTY permit_types means "sees every
--     permit type" — a real access hole for 75 new staff accounts that
--     shouldn't see anything yet. The placeholder keeps their queues empty
--     (safe default) until pipeline routing is actually implemented and
--     reviewer.php is updated to route by pipeline stage instead.
--
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/008_permit_pipeline.sql

USE permittrack;

-- ---------------------------------------------------------------------------
-- Barangays (Dasmariñas City, Cavite — 75 barangays)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS barangays (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_barangay_name (name)
) ENGINE=InnoDB;

INSERT IGNORE INTO barangays (name) VALUES
    ('Burol'), ('Burol I'), ('Burol II'), ('Burol III'),
    ('Datu Esmael'),
    ('Emmanuel Bergado I'), ('Emmanuel Bergado II'),
    ('Fatima I'), ('Fatima II'), ('Fatima III'),
    ('H-2'),
    ('Langkaan I'), ('Langkaan II'),
    ('Luzviminda I'), ('Luzviminda II'),
    ('Paliparan I'), ('Paliparan II'), ('Paliparan III'),
    ('Sabang'),
    ('Saint Peter I'), ('Saint Peter II'),
    ('Salawag'),
    ('Salitran I'), ('Salitran II'), ('Salitran III'), ('Salitran IV'),
    ('Sampaloc I'), ('Sampaloc II'), ('Sampaloc III'), ('Sampaloc IV'), ('Sampaloc V'),
    ('San Agustin I'), ('San Agustin II'), ('San Agustin III'),
    ('San Andres I'), ('San Andres II'),
    ('San Antonio de Padua I'), ('San Antonio de Padua II'),
    ('San Dionisio'),
    ('San Esteban'),
    ('San Francisco I'), ('San Francisco II'),
    ('San Isidro Labrador I'), ('San Isidro Labrador II'),
    ('San Jose'),
    ('San Juan'),
    ('San Lorenzo Ruiz I'), ('San Lorenzo Ruiz II'),
    ('San Luis I'), ('San Luis II'),
    ('San Manuel I'), ('San Manuel II'),
    ('San Mateo'),
    ('San Miguel'), ('San Miguel II'),
    ('San Nicolas I'), ('San Nicolas II'),
    ('San Roque'),
    ('San Simon'),
    ('Santa Cristina I'), ('Santa Cristina II'),
    ('Santa Cruz I'), ('Santa Cruz II'),
    ('Santa Fe'),
    ('Santa Lucia'),
    ('Santa Maria'),
    ('Santo Cristo'),
    ('Santo Niño I'), ('Santo Niño II'),
    ('Victoria Reyes'),
    ('Zone I'), ('Zone I-B'), ('Zone II'), ('Zone III'), ('Zone IV');

-- Residents pick their barangay at registration; businesses have their own,
-- separate barangay (their registered address, not the owner's residence).
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
               AND COLUMN_NAME = 'barangay_id');
SET @sql := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN barangay_id INT NULL AFTER barangay',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_user_barangay');
SET @sql := IF(@fk = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_user_barangay FOREIGN KEY (barangay_id) REFERENCES barangays(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Best-effort backfill from the existing free-text `barangay` column
UPDATE users u
JOIN barangays b ON TRIM(LOWER(u.barangay)) = TRIM(LOWER(b.name))
SET u.barangay_id = b.id
WHERE u.barangay_id IS NULL AND u.barangay IS NOT NULL;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'businesses'
               AND COLUMN_NAME = 'barangay_id');
SET @sql := IF(@col = 0,
  'ALTER TABLE businesses ADD COLUMN barangay_id INT NULL AFTER barangay',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'businesses' AND CONSTRAINT_NAME = 'fk_business_barangay');
SET @sql := IF(@fk = 0,
  'ALTER TABLE businesses ADD CONSTRAINT fk_business_barangay FOREIGN KEY (barangay_id) REFERENCES barangays(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE businesses biz
JOIN barangays b ON TRIM(LOWER(biz.barangay)) = TRIM(LOWER(b.name))
SET biz.barangay_id = b.id
WHERE biz.barangay_id IS NULL AND biz.barangay IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Departments: one row per barangay secretariat, plus the new city offices
-- ---------------------------------------------------------------------------

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'departments'
               AND COLUMN_NAME = 'barangay_id');
SET @sql := IF(@col = 0,
  'ALTER TABLE departments ADD COLUMN barangay_id INT NULL AFTER code',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'departments' AND CONSTRAINT_NAME = 'fk_department_barangay');
SET @sql := IF(@fk = 0,
  'ALTER TABLE departments ADD CONSTRAINT fk_department_barangay FOREIGN KEY (barangay_id) REFERENCES barangays(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- New non-barangay pipeline offices (OBO, BPLO, CHO already exist from 004)
INSERT IGNORE INTO departments (name, code, description, permit_types) VALUES
    ('City Planning and Development Office', 'CPDO', 'Zoning / Locational Clearance', '__unassigned__'),
    ('Bureau of Fire Protection — Dasmariñas Station', 'BFP', 'Fire Safety Inspection Certificate', '__unassigned__'),
    ('City Environment and Natural Resources Office', 'CENRO', 'Environmental and waste clearances', '__unassigned__'),
    ('City Assessor''s Office', 'ASSESSOR', 'Tax declaration, RPT-related clearances', '__unassigned__'),
    ('City Treasurer''s Office', 'TREASURER', 'Fee assessment, RPT clearance, permit issuance', '__unassigned__'),
    ('City Engineer — Public Works', 'ENGINEER', 'Excavation / road-cut / right-of-way review', '__unassigned__'),
    ('Philippine National Police — Dasmariñas', 'PNP', 'Police clearance, event safety coordination', '__unassigned__'),
    ('City Traffic Management Office / TODA Section', 'TRAFFIC', 'Tricycle operator franchise (MTOP)', '__unassigned__'),
    ('Food and Drug Administration (national, co-routed)', 'FDA', 'LTO/CPR for food manufacturing — no PermitTrack staff account; external agency', '__unassigned__');

-- One department per barangay = that barangay's secretariat
INSERT INTO departments (name, code, description, permit_types, barangay_id)
SELECT CONCAT('Barangay ', b.name, ' Secretariat'),
       CONCAT('BRGY-', b.id),
       CONCAT('Barangay-level clearances for ', b.name),
       '__unassigned__',
       b.id
FROM barangays b
WHERE NOT EXISTS (SELECT 1 FROM departments d WHERE d.barangay_id = b.id);

-- One Barangay Secretary staff account per barangay department, seeded day
-- one (password: Password123!, same demo hash as the existing seed accounts).
INSERT INTO users (role, account_type, department_id, email, password_hash, full_name, onboarding_completed, email_verified_at)
SELECT 'staff',
       'resident',
       d.id,
       CONCAT('secretary.', LOWER(REPLACE(REPLACE(REPLACE(b.name, ' ', '-'), 'ñ', 'n'), '.', '')), '@dasmarinas.gov.ph.demo'),
       '$2y$10$hmPWXOOOOcky2Ev1RKOi/.6ZJUJiQvGWB4Zaf1PDMPUd87yLsMtHu',
       CONCAT('Barangay Secretary — ', b.name),
       1,
       NOW()
FROM departments d
JOIN barangays b ON b.id = d.barangay_id
WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.department_id = d.id AND u.role = 'staff'
);

-- ---------------------------------------------------------------------------
-- Permit types (replaces the flat 5-value enum going forward; the enum
-- column on `applications` is left in place for the existing app code)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS permit_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    track ENUM('construction', 'business', 'personal', 'barangay_standalone') NOT NULL,
    resident_eligible TINYINT(1) NOT NULL DEFAULT 0,
    business_eligible TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_permit_type_name (name)
) ENGINE=InnoDB;

INSERT IGNORE INTO permit_types (name, track, resident_eligible, business_eligible) VALUES
    -- Construction track — resident or business
    ('Building Permit', 'construction', 1, 1),
    ('Occupancy Permit', 'construction', 1, 1),
    ('Fencing Permit', 'construction', 1, 1),
    ('Demolition Permit', 'construction', 1, 1),
    ('Excavation/Road-Cut Permit', 'construction', 1, 1),
    -- Business track — business only, except Special Event (both)
    ('Business License', 'business', 0, 1),
    ('Food Service', 'business', 0, 1),
    ('Sign Permit', 'business', 0, 1),
    ('Special Event', 'business', 1, 1),
    ('Liquor/Tobacco License', 'business', 0, 1),
    ('MTOP/TODA Permit', 'business', 0, 1),
    ('Market Stall/Vending Permit', 'business', 0, 1),
    -- Personal / barangay-only track — resident only, terminal at barangay
    ('Barangay Clearance (Personal)', 'personal', 1, 0),
    ('Barangay Employment Clearance', 'personal', 1, 0),
    ('First-Time Jobseeker Certificate', 'personal', 1, 0),
    ('Certificate of Residency', 'personal', 1, 0),
    ('Certificate of Indigency', 'personal', 1, 0),
    ('Certificate of Good Moral Character', 'personal', 1, 0),
    ('Certificate to File Action', 'personal', 1, 0),
    -- Standalone barangay clearances that are ALSO stage 1 of a bigger permit
    -- (see permit_pipeline_steps below); standalone request = resident-only
    ('Barangay Business Clearance (New)', 'barangay_standalone', 1, 0),
    ('Barangay Business Clearance (Renewal)', 'barangay_standalone', 1, 0),
    ('Barangay Clearance for Special Events', 'barangay_standalone', 1, 0),
    ('Barangay Clearance for Tricycles (TODA)', 'barangay_standalone', 1, 0),
    ('Barangay Construction Clearance', 'barangay_standalone', 1, 0),
    ('Barangay Fencing Clearance', 'barangay_standalone', 1, 0),
    ('Barangay Demolition Clearance', 'barangay_standalone', 1, 0),
    ('Barangay Excavation/Road-Cut Clearance', 'barangay_standalone', 1, 0);

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications'
               AND COLUMN_NAME = 'permit_type_id');
SET @sql := IF(@col = 0,
  'ALTER TABLE applications ADD COLUMN permit_type_id INT NULL AFTER permit_type',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND CONSTRAINT_NAME = 'fk_app_permit_type');
SET @sql := IF(@fk = 0,
  'ALTER TABLE applications ADD CONSTRAINT fk_app_permit_type FOREIGN KEY (permit_type_id) REFERENCES permit_types(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill from the legacy enum where the name maps directly
UPDATE applications a JOIN permit_types pt ON pt.name = 'Food Service' SET a.permit_type_id = pt.id WHERE a.permit_type = 'Food Service' AND a.permit_type_id IS NULL;
UPDATE applications a JOIN permit_types pt ON pt.name = 'Building Permit' SET a.permit_type_id = pt.id WHERE a.permit_type = 'Building/Renovation' AND a.permit_type_id IS NULL;
UPDATE applications a JOIN permit_types pt ON pt.name = 'Sign Permit' SET a.permit_type_id = pt.id WHERE a.permit_type = 'Sign' AND a.permit_type_id IS NULL;
UPDATE applications a JOIN permit_types pt ON pt.name = 'Business License' SET a.permit_type_id = pt.id WHERE a.permit_type = 'Business License' AND a.permit_type_id IS NULL;
UPDATE applications a JOIN permit_types pt ON pt.name = 'Special Event' SET a.permit_type_id = pt.id WHERE a.permit_type = 'Special Event' AND a.permit_type_id IS NULL;

-- ---------------------------------------------------------------------------
-- Pipeline steps: fixed base sequence per permit type, plus conditional
-- branch steps. office_code 'BARANGAY' is a sentinel — it does not match a
-- single department; it means "route to the applicant's or business's own
-- barangay secretariat via barangay_id", resolved at application time by
-- future routing code, not by this table.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS permit_pipeline_steps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    permit_type_id INT NOT NULL,
    step_order DECIMAL(5,2) NOT NULL,
    office_code VARCHAR(20) NOT NULL,
    step_label VARCHAR(150) NOT NULL,
    condition_key VARCHAR(60) NULL,
    condition_label VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pipeline_permit_type (permit_type_id, step_order),
    FOREIGN KEY (permit_type_id) REFERENCES permit_types(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Building Permit
INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label, condition_key, condition_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label, s.condition_key, s.condition_label
FROM permit_types pt
JOIN (
    SELECT 1.0 step_order, 'BARANGAY' office_code, 'Barangay Construction Clearance' step_label, NULL condition_key, NULL condition_label
    UNION ALL SELECT 1.5, 'ENGINEER', 'HOA/Developer Clearance', 'inside_subdivision', 'Is this inside a private subdivision?'
    UNION ALL SELECT 2.0, 'CPDO', 'Zoning Clearance', NULL, NULL
    UNION ALL SELECT 3.0, 'OBO', 'Technical plan review', NULL, NULL
    UNION ALL SELECT 3.3, 'OBO', 'Mechanical systems review', 'has_mechanical', 'Does this include mechanical systems (elevator, HVAC, generator)?'
    UNION ALL SELECT 3.6, 'OBO', 'Electronics/telecom systems review', 'has_electronics', 'Does this include electronics/telecom/security systems?'
    UNION ALL SELECT 4.0, 'CENRO', 'Environmental clearance', NULL, NULL
    UNION ALL SELECT 5.0, 'ASSESSOR', 'RPT clearance', NULL, NULL
    UNION ALL SELECT 6.0, 'OBO', 'Building Permit issued', NULL, NULL
) s ON 1=1
WHERE pt.name = 'Building Permit'
  AND NOT EXISTS (SELECT 1 FROM permit_pipeline_steps existing WHERE existing.permit_type_id = pt.id);

-- Occupancy Permit
INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label, condition_key, condition_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label, s.condition_key, s.condition_label
FROM permit_types pt
JOIN (
    SELECT 1.0 step_order, 'OBO' office_code, 'Final inspection' step_label, NULL condition_key, NULL condition_label
    UNION ALL SELECT 2.0, 'BFP', 'Fire Safety Inspection Certificate', NULL, NULL
    UNION ALL SELECT 3.0, 'OBO', 'Certificate of Occupancy issued', NULL, NULL
) s ON 1=1
WHERE pt.name = 'Occupancy Permit'
  AND NOT EXISTS (SELECT 1 FROM permit_pipeline_steps existing WHERE existing.permit_type_id = pt.id);

-- Fencing Permit
INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label, condition_key, condition_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label, s.condition_key, s.condition_label
FROM permit_types pt
JOIN (
    SELECT 1.0 step_order, 'BARANGAY' office_code, 'Barangay Fencing Clearance' step_label, NULL condition_key, NULL condition_label
    UNION ALL SELECT 2.0, 'OBO', 'Engineer review', NULL, NULL
    UNION ALL SELECT 2.5, 'CENRO', 'Waterway/drainage easement review', 'affects_waterway', 'Does the fence line affect a waterway or drainage easement?'
    UNION ALL SELECT 3.0, 'OBO', 'Fencing Permit issued', NULL, NULL
) s ON 1=1
WHERE pt.name = 'Fencing Permit'
  AND NOT EXISTS (SELECT 1 FROM permit_pipeline_steps existing WHERE existing.permit_type_id = pt.id);

-- Demolition Permit
INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label, condition_key, condition_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label, s.condition_key, s.condition_label
FROM permit_types pt
JOIN (
    SELECT 1.0 step_order, 'BARANGAY' office_code, 'Barangay Demolition Clearance' step_label, NULL condition_key, NULL condition_label
    UNION ALL SELECT 2.0, 'OBO', 'Engineer review', NULL, NULL
    UNION ALL SELECT 2.5, 'CENRO', 'Hazardous materials review', 'has_hazmat', 'Are hazardous materials present (e.g. asbestos)?'
    UNION ALL SELECT 3.0, 'OBO', 'Demolition Permit issued', NULL, NULL
) s ON 1=1
WHERE pt.name = 'Demolition Permit'
  AND NOT EXISTS (SELECT 1 FROM permit_pipeline_steps existing WHERE existing.permit_type_id = pt.id);

-- Excavation/Road-Cut Permit
INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label, condition_key, condition_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label, s.condition_key, s.condition_label
FROM permit_types pt
JOIN (
    SELECT 1.0 step_order, 'BARANGAY' office_code, 'Barangay Excavation/Road-Cut Clearance' step_label, NULL condition_key, NULL condition_label
    UNION ALL SELECT 2.0, 'ENGINEER', 'Public Works review', NULL, NULL
    UNION ALL SELECT 3.0, 'CENRO', 'Environmental/drainage clearance', NULL, NULL
    UNION ALL SELECT 4.0, 'ENGINEER', 'Excavation/Road-Cut Permit issued', NULL, NULL
) s ON 1=1
WHERE pt.name = 'Excavation/Road-Cut Permit'
  AND NOT EXISTS (SELECT 1 FROM permit_pipeline_steps existing WHERE existing.permit_type_id = pt.id);

-- Business License
INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label, condition_key, condition_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label, s.condition_key, s.condition_label
FROM permit_types pt
JOIN (
    SELECT 1.0 step_order, 'BARANGAY' office_code, 'Barangay Business Clearance' step_label, NULL condition_key, NULL condition_label
    UNION ALL SELECT 2.0, 'CPDO', 'Zoning Clearance', NULL, NULL
    UNION ALL SELECT 3.0, 'BPLO', 'Business tax and fee assessment', NULL, NULL
    UNION ALL SELECT 4.0, 'TREASURER', 'Payment and Mayor''s Permit issued', NULL, NULL
) s ON 1=1
WHERE pt.name = 'Business License'
  AND NOT EXISTS (SELECT 1 FROM permit_pipeline_steps existing WHERE existing.permit_type_id = pt.id);

-- Food Service
INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label, condition_key, condition_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label, s.condition_key, s.condition_label
FROM permit_types pt
JOIN (
    SELECT 1.0 step_order, 'BARANGAY' office_code, 'Barangay Business Clearance' step_label, NULL condition_key, NULL condition_label
    UNION ALL SELECT 2.0, 'CHO', 'Sanitary Permit, water potability, staff health cards', NULL, NULL
    UNION ALL SELECT 3.0, 'BFP', 'Fire Safety Inspection Certificate', NULL, NULL
    UNION ALL SELECT 3.5, 'FDA', 'FDA License to Operate / Certificate of Product Registration', 'is_manufacturing', 'Will products be manufactured, repacked, or bottled for retail or export?'
    UNION ALL SELECT 4.0, 'BPLO', 'Mayor''s Permit issued', NULL, NULL
) s ON 1=1
WHERE pt.name = 'Food Service'
  AND NOT EXISTS (SELECT 1 FROM permit_pipeline_steps existing WHERE existing.permit_type_id = pt.id);

-- Sign Permit
INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label, condition_key, condition_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label, s.condition_key, s.condition_label
FROM permit_types pt
JOIN (
    SELECT 1.0 step_order, 'BARANGAY' office_code, 'Barangay Business Clearance' step_label, NULL condition_key, NULL condition_label
    UNION ALL SELECT 2.0, 'CPDO', 'Placement/zoning check', NULL, NULL
    UNION ALL SELECT 2.5, 'OBO', 'Structural review', 'is_structural_sign', 'Is this a large/structural billboard (vs. storefront signage)?'
    UNION ALL SELECT 3.0, 'BPLO', 'Sign Permit issued', NULL, NULL
) s ON 1=1
WHERE pt.name = 'Sign Permit'
  AND NOT EXISTS (SELECT 1 FROM permit_pipeline_steps existing WHERE existing.permit_type_id = pt.id);

-- Special Event
INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label, condition_key, condition_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label, s.condition_key, s.condition_label
FROM permit_types pt
JOIN (
    SELECT 1.0 step_order, 'BARANGAY' office_code, 'Barangay Clearance for Special Events' step_label, NULL condition_key, NULL condition_label
    UNION ALL SELECT 2.0, 'PNP', 'Police coordination', NULL, NULL
    UNION ALL SELECT 3.0, 'BFP', 'Crowd safety check', NULL, NULL
    UNION ALL SELECT 3.5, 'BPLO', 'Liquor License', 'serves_alcohol', 'Will alcohol be sold or served at the event?'
    UNION ALL SELECT 4.0, 'BPLO', 'Special Event Permit issued', NULL, NULL
) s ON 1=1
WHERE pt.name = 'Special Event'
  AND NOT EXISTS (SELECT 1 FROM permit_pipeline_steps existing WHERE existing.permit_type_id = pt.id);

-- Liquor/Tobacco License
INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label, condition_key, condition_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label, s.condition_key, s.condition_label
FROM permit_types pt
JOIN (
    SELECT 1.0 step_order, 'BPLO' office_code, 'Application review' step_label, NULL condition_key, NULL condition_label
    UNION ALL SELECT 2.0, 'PNP', 'Police clearance', NULL, NULL
    UNION ALL SELECT 3.0, 'BPLO', 'License issued', NULL, NULL
) s ON 1=1
WHERE pt.name = 'Liquor/Tobacco License'
  AND NOT EXISTS (SELECT 1 FROM permit_pipeline_steps existing WHERE existing.permit_type_id = pt.id);

-- MTOP/TODA Permit
INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label, condition_key, condition_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label, s.condition_key, s.condition_label
FROM permit_types pt
JOIN (
    SELECT 1.0 step_order, 'BARANGAY' office_code, 'Barangay Clearance for Tricycles (TODA)' step_label, NULL condition_key, NULL condition_label
    UNION ALL SELECT 2.0, 'TRAFFIC', 'City Traffic Management Office review', NULL, NULL
    UNION ALL SELECT 3.0, 'BPLO', 'MTOP issued', NULL, NULL
) s ON 1=1
WHERE pt.name = 'MTOP/TODA Permit'
  AND NOT EXISTS (SELECT 1 FROM permit_pipeline_steps existing WHERE existing.permit_type_id = pt.id);

-- Market Stall/Vending Permit
INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label, condition_key, condition_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label, s.condition_key, s.condition_label
FROM permit_types pt
JOIN (
    SELECT 1.0 step_order, 'BARANGAY' office_code, 'Barangay Business Clearance' step_label, NULL condition_key, NULL condition_label
    UNION ALL SELECT 2.0, 'BPLO', 'Market Section review', NULL, NULL
    UNION ALL SELECT 3.0, 'TREASURER', 'Stall fee assessed, permit issued', NULL, NULL
) s ON 1=1
WHERE pt.name = 'Market Stall/Vending Permit'
  AND NOT EXISTS (SELECT 1 FROM permit_pipeline_steps existing WHERE existing.permit_type_id = pt.id);

-- Personal + standalone barangay-only permits: a single barangay step each
INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label, condition_key, condition_label)
SELECT pt.id, 1.0, 'BARANGAY', 'Issued directly by the barangay', NULL, NULL
FROM permit_types pt
WHERE pt.track IN ('personal', 'barangay_standalone')
  AND NOT EXISTS (SELECT 1 FROM permit_pipeline_steps existing WHERE existing.permit_type_id = pt.id);

-- ---------------------------------------------------------------------------
-- Per-application branch-question answers (forced at submission; an
-- undeclared condition that turns out to apply voids the permit — enforced
-- by the application layer, not this table)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS application_conditions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    condition_key VARCHAR(60) NOT NULL,
    answer TINYINT(1) NOT NULL,
    declared_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_app_condition (application_id, condition_key),
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB;
