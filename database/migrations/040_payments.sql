-- ---------------------------------------------------------------------------
-- 040 -- Payment bridges, fee schedule, and the payments table
--
-- Two new staff roles, both pure payment bridges (they confirm a payment arrived; they never
-- decide a permit). Kept as brand-new departments rather than reusing an existing review
-- department, specifically so a payment-bridge login has literally no office_code/pipeline-step
-- ownership to act on -- "never make permit decisions" is then true by construction, not just by
-- convention:
--
--   * Barangay Secretary (payment role) -- one new department+account PER BARANGAY
--     ("Barangay <name> -- Payments", code BRGY-PAY-<barangay_id>), scoped to that barangay's
--     own barangay-level permits. This is intentionally a SEPARATE account from the existing
--     per-barangay "Barangay Secretary" pipeline-review account (migration 008) rather than that
--     same login gaining payment powers -- seeding a second department with the same barangay_id
--     would also make resolve_office_department()'s "whichever department covers this barangay"
--     lookup ambiguous, which is why departments.purpose exists below (that lookup now filters
--     to purpose='review').
--   * Municipal Treasury -- one department+account citywide ("Municipal Treasury (Payments)",
--     code TREASURY_PAY), receiving every payment that is not barangay-level. Deliberately not
--     the existing TREASURER department (City Treasurer's Office), which already owns specific
--     documents on a couple of permit types -- conflating the two would mean that account COULD
--     decide a permit, which the spec rules out for a payment bridge.
--
-- Fees: permit_types.fee is the amount currently charged for a type; applications.fee_charged
-- snapshots what was actually charged at submission time, since fees can change later without
-- rewriting what an applicant already agreed to pay (same pattern as the existing delivery_fee
-- snapshot). applications.status gains 'Payment Pending': a submission with a nonzero fee sits
-- here -- created, documents attached, but its pipeline not yet instantiated -- until payment
-- succeeds (api/payments.php), at which point it moves on exactly as an old free submission
-- always has. A zero fee (first-time jobseeker, or a permit with no fee) skips this state
-- entirely, same as before this migration.
--
-- Idempotent throughout: columns/tables guarded by information_schema/IF NOT EXISTS, every seed
-- INSERT is WHERE NOT EXISTS, and the fee UPDATEs are plain idempotent assignments.
-- ---------------------------------------------------------------------------

-- departments.purpose -- review (default, existing behaviour) vs payment (new, inert) -----------
SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'departments' AND COLUMN_NAME = 'purpose');
SET @s1 := IF(@c1 = 0,
  "ALTER TABLE departments ADD COLUMN purpose ENUM('review','payment') NOT NULL DEFAULT 'review' AFTER permit_types",
  'DO 0');
PREPARE s1 FROM @s1; EXECUTE s1; DEALLOCATE PREPARE s1;

-- One payment department + staff account per barangay -------------------------------------------
INSERT INTO departments (name, code, barangay_id, description, permit_types, purpose)
SELECT CONCAT('Barangay ', b.name, ' - Payments'), CONCAT('BRGY-PAY-', b.id), b.id,
       CONCAT('Payment confirmation for barangay-level permits in ', b.name), '__unassigned__', 'payment'
  FROM barangays b
 WHERE NOT EXISTS (SELECT 1 FROM departments d WHERE d.barangay_id = b.id AND d.purpose = 'payment');

INSERT INTO users (role, account_type, department_id, email, password_hash, full_name, onboarding_completed, email_verified_at)
SELECT 'staff', 'resident', d.id,
       CONCAT('payments.', LOWER(REPLACE(REPLACE(REPLACE(b.name, ' ', '-'), UNHEX('C3B1'), 'n'), '.', '')), '@dasmarinas.gov.ph.demo'),
       '$2y$10$hmPWXOOOOcky2Ev1RKOi/.6ZJUJiQvGWB4Zaf1PDMPUd87yLsMtHu',
       CONCAT('Barangay Payments - ', b.name), 1, NOW()
  FROM departments d JOIN barangays b ON b.id = d.barangay_id AND d.purpose = 'payment'
 WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.department_id = d.id AND u.role = 'staff');

-- One Municipal Treasury payment department + staff account, citywide ---------------------------
INSERT INTO departments (name, code, barangay_id, description, permit_types, purpose)
SELECT 'Municipal Treasury (Payments)', 'TREASURY_PAY', NULL,
       'Receives payment for every permit that is not barangay-level', '__unassigned__', 'payment'
 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'TREASURY_PAY');

INSERT INTO users (role, account_type, department_id, email, password_hash, full_name, onboarding_completed, email_verified_at)
SELECT 'staff', 'resident', d.id, 'treasury.payments@dasmarinas.gov.ph.demo',
       '$2y$10$hmPWXOOOOcky2Ev1RKOi/.6ZJUJiQvGWB4Zaf1PDMPUd87yLsMtHu',
       'Municipal Treasury - Payments', 1, NOW()
  FROM departments d WHERE d.code = 'TREASURY_PAY'
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.department_id = d.id AND u.role = 'staff');

-- permit_types.fee --------------------------------------------------------------------------------
SET @c2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'permit_types' AND COLUMN_NAME = 'fee');
SET @s2 := IF(@c2 = 0, 'ALTER TABLE permit_types ADD COLUMN fee DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER business_eligible', 'DO 0');
PREPARE s2 FROM @s2; EXECUTE s2; DEALLOCATE PREPARE s2;

UPDATE permit_types SET fee = CASE name
    WHEN 'Building Permit' THEN 15500.00
    WHEN 'Demolition Permit' THEN 3000.00
    WHEN 'Excavation/Road-Cut Permit' THEN 1750.00
    WHEN 'Fencing Permit' THEN 1250.00
    WHEN 'Occupancy Permit' THEN 3000.00
    WHEN 'Business License' THEN 11000.00
    WHEN 'Business Permit Renewal' THEN 26000.00
    WHEN 'Food Service' THEN 600.00
    WHEN 'Food Service (Sanitary) Renewal' THEN 600.00
    WHEN 'Liquor/Tobacco License' THEN 3000.00
    WHEN 'Liquor/Tobacco License Renewal' THEN 3000.00
    WHEN 'Market Stall/Vending Permit' THEN 1500.00
    WHEN 'Market Stall/Vending Permit Renewal' THEN 1500.00
    WHEN 'MTOP/TODA Permit' THEN 800.00
    WHEN 'MTOP/TODA Permit Renewal' THEN 800.00
    WHEN 'Sign Permit' THEN 900.00
    WHEN 'Sign Permit Renewal' THEN 900.00
    WHEN 'Special Event' THEN 1750.00
    WHEN 'Barangay Clearance (Personal)' THEN 100.00
    WHEN 'Barangay Employment Clearance' THEN 100.00
    WHEN 'Certificate of Good Moral Character' THEN 100.00
    WHEN 'Certificate of Indigency' THEN 25.00
    WHEN 'Certificate of Residency' THEN 75.00
    WHEN 'Certificate to File Action' THEN 200.00
    WHEN 'First-Time Jobseeker Certificate' THEN 0.00
    WHEN 'Barangay Business Clearance (New)' THEN 850.00
    WHEN 'Barangay Business Clearance (Renewal)' THEN 850.00
    WHEN 'Barangay Clearance for Special Events' THEN 900.00
    WHEN 'Barangay Clearance for Tricycles (TODA)' THEN 125.00
    WHEN 'Barangay Clearance for Tricycles (TODA) Renewal' THEN 125.00
    WHEN 'Barangay Construction Clearance' THEN 1750.00
    WHEN 'Barangay Demolition Clearance' THEN 900.00
    WHEN 'Barangay Excavation/Road-Cut Clearance' THEN 650.00
    WHEN 'Barangay Fencing Clearance' THEN 600.00
    ELSE fee
END
WHERE name IN (
    'Building Permit','Demolition Permit','Excavation/Road-Cut Permit','Fencing Permit','Occupancy Permit',
    'Business License','Business Permit Renewal','Food Service','Food Service (Sanitary) Renewal',
    'Liquor/Tobacco License','Liquor/Tobacco License Renewal','Market Stall/Vending Permit',
    'Market Stall/Vending Permit Renewal','MTOP/TODA Permit','MTOP/TODA Permit Renewal',
    'Sign Permit','Sign Permit Renewal','Special Event','Barangay Clearance (Personal)',
    'Barangay Employment Clearance','Certificate of Good Moral Character','Certificate of Indigency',
    'Certificate of Residency','Certificate to File Action','First-Time Jobseeker Certificate',
    'Barangay Business Clearance (New)','Barangay Business Clearance (Renewal)',
    'Barangay Clearance for Special Events','Barangay Clearance for Tricycles (TODA)',
    'Barangay Clearance for Tricycles (TODA) Renewal','Barangay Construction Clearance',
    'Barangay Demolition Clearance','Barangay Excavation/Road-Cut Clearance','Barangay Fencing Clearance'
);

-- applications: fee snapshot + the new pre-pipeline payment-pending status -----------------------
SET @c3 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'fee_charged');
SET @s3 := IF(@c3 = 0, 'ALTER TABLE applications ADD COLUMN fee_charged DECIMAL(10,2) NULL AFTER priority', 'DO 0');
PREPARE s3 FROM @s3; EXECUTE s3; DEALLOCATE PREPARE s3;

SET @e := (SELECT COLUMN_TYPE FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'status');
SET @s4 := IF(@e NOT LIKE '%Payment Pending%',
  "ALTER TABLE applications MODIFY COLUMN status
     ENUM('Payment Pending','Submitted','Under Review','Inspection Scheduled','Inspector Notes','Approved','Rejected','Withdrawn')
     NOT NULL DEFAULT 'Submitted'",
  'DO 0');
PREPARE s4 FROM @s4; EXECUTE s4; DEALLOCATE PREPARE s4;

-- payments ----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    method ENUM('gcash','maya','bank_transfer') NOT NULL,
    reference VARCHAR(100) NULL,
    status ENUM('pending','succeeded','failed') NOT NULL DEFAULT 'pending',
    recipient_department_id INT NOT NULL,
    batch_token VARCHAR(40) NULL,
    confirmed_by INT NULL,
    confirmed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_payments_application (application_id),
    KEY idx_payments_recipient_status (recipient_department_id, status),
    CONSTRAINT fk_payment_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_recipient FOREIGN KEY (recipient_department_id) REFERENCES departments(id),
    CONSTRAINT fk_payment_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
