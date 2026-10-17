-- ---------------------------------------------------------------------------
-- 046 — Building Permit Renewal
--
-- Enables renewal process for Building Permit.
-- In accordance with the National Building Code (PD 1096), building permits lapse after
-- 1 year if construction has not commenced or if work is suspended/abandoned for 120 days.
-- Renewal routes through the exact same offices as the original Building Permit
-- (BARANGAY, ENGINEER if subdivision, CPDO, OBO, CENRO, ASSESSOR, OBO), reviews previous
-- approved files and construction plans, and delivers the re-issued Building Permit.
--
-- Idempotent: safe to run multiple times.
-- ---------------------------------------------------------------------------

-- 1. Expand applications.permit_type ENUM
SET @e := (SELECT COLUMN_TYPE FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'permit_type');
SET @s := IF(@e NOT LIKE '%Building Permit Renewal%',
  "ALTER TABLE applications MODIFY COLUMN permit_type ENUM(
    'Food Service','Building/Renovation','Sign','Business License','Special Event',
    'Building Permit','Occupancy Permit','Fencing Permit','Demolition Permit','Excavation/Road-Cut Permit',
    'Sign Permit','Liquor/Tobacco License','MTOP/TODA Permit','Market Stall/Vending Permit',
    'Barangay Clearance (Personal)','Barangay Employment Clearance','First-Time Jobseeker Certificate',
    'Certificate of Residency','Certificate of Indigency','Certificate of Good Moral Character','Certificate to File Action',
    'Barangay Business Clearance (New)','Barangay Business Clearance (Renewal)',
    'Barangay Clearance for Special Events','Barangay Clearance for Tricycles (TODA)',
    'Barangay Construction Clearance','Barangay Fencing Clearance','Barangay Demolition Clearance',
    'Barangay Excavation/Road-Cut Clearance','Business Permit Renewal','Food Service (Sanitary) Renewal',
    'Liquor/Tobacco License Renewal','Market Stall/Vending Permit Renewal','MTOP/TODA Permit Renewal',
    'Sign Permit Renewal','Barangay Clearance for Tricycles (TODA) Renewal','Building Permit Renewal'
  ) NULL",
  'DO 0');
PREPARE s FROM @s; EXECUTE s; DEALLOCATE PREPARE s;

-- 2. Insert into permit_types if missing
INSERT INTO permit_types (name, description, track, resident_eligible, business_eligible, fee, is_active)
SELECT 'Building Permit Renewal',
       'The yearly renewal of your building permit for ongoing or uncompleted construction, re-verifying plan compliance, site safety, and real property tax clearance.',
       'construction', 1, 1, 15500.00, 1
 WHERE NOT EXISTS (SELECT 1 FROM permit_types WHERE name = 'Building Permit Renewal');

UPDATE permit_types
   SET description = 'The yearly renewal of your building permit for ongoing or uncompleted construction, re-verifying plan compliance, site safety, and real property tax clearance.',
       track = 'construction',
       resident_eligible = 1,
       business_eligible = 1,
       fee = 15500.00,
       is_active = 1
 WHERE name = 'Building Permit Renewal';

-- 3. Pipeline steps for Building Permit Renewal (mirrors original Building Permit route)
DELETE FROM permit_pipeline_steps WHERE permit_type_id = (SELECT id FROM permit_types WHERE name = 'Building Permit Renewal');
DELETE FROM permit_type_documents WHERE permit_type_id = (SELECT id FROM permit_types WHERE name = 'Building Permit Renewal');

INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label, condition_key, condition_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label, s.condition_key, s.condition_label
  FROM permit_types pt
  JOIN (
        SELECT 1.00 AS step_order, 'BARANGAY' AS office_code, 'Barangay Construction Clearance (renewal)' AS step_label, NULL AS condition_key, NULL AS condition_label
  UNION SELECT 1.50, 'ENGINEER', 'HOA/Developer Clearance', 'inside_subdivision', 'Is this inside a private subdivision?'
  UNION SELECT 2.00, 'CPDO', 'Zoning Clearance', NULL, NULL
  UNION SELECT 3.00, 'OBO', 'Technical plan review (renewal)', NULL, NULL
  UNION SELECT 3.30, 'OBO', 'Mechanical systems review', 'has_mechanical', 'Does this include mechanical systems (elevator, HVAC, generator)?'
  UNION SELECT 3.60, 'OBO', 'Electronics/telecom systems review', 'has_electronics', 'Does this include electronics/telecom/security systems?'
  UNION SELECT 4.00, 'CENRO', 'Environmental clearance', NULL, NULL
  UNION SELECT 5.00, 'ASSESSOR', 'RPT clearance', NULL, NULL
  UNION SELECT 6.00, 'OBO', 'Building Permit re-issued', NULL, NULL
       ) s
 WHERE pt.name = 'Building Permit Renewal';

-- 4. Required documents for Building Permit Renewal
INSERT INTO permit_type_documents (permit_type_id, doc_name, office_code, sort_order)
SELECT pt.id, d.doc_name, d.office_code, d.sort_order
  FROM permit_types pt
  JOIN (
        SELECT 'Previous Building Permit' AS doc_name, 'OBO' AS office_code, 1 AS sort_order
  UNION SELECT 'Previous Barangay Construction Clearance', 'BARANGAY', 2
  UNION SELECT 'Site Plan', 'OBO', 3
  UNION SELECT 'Structural Drawings', 'OBO', 4
  UNION SELECT 'Lot Title or Tax Declaration', 'ASSESSOR', 5
  UNION SELECT 'Contractor License', 'OBO', 6
       ) d
 WHERE pt.name = 'Building Permit Renewal';

-- 5. Senior citizen condition in permit_type_conditions
INSERT INTO permit_type_conditions (permit_type_id, condition_key, question_label, yes_label, no_label, requires_document, sort_order)
SELECT pt.id, 'senior_citizen', 'Are you a senior citizen?', 'Yes', 'No', 'Senior Citizen ID', 0
  FROM permit_types pt
 WHERE pt.name = 'Building Permit Renewal'
   AND NOT EXISTS (
       SELECT 1 FROM permit_type_conditions c WHERE c.permit_type_id = pt.id AND c.condition_key = 'senior_citizen'
   );

