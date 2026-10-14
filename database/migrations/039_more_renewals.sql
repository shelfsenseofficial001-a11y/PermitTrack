-- ---------------------------------------------------------------------------
-- 039 — Six more renewal permit types, modeled on 020_business_permit_renewal.sql
--
-- Business Permit Renewal and Barangay Business Clearance (Renewal) already existed and are left
-- untouched. These six cover the rest of the renewable catalogue (see RENEWABLE_PERMITS in
-- api/lib/pipeline.php): Food Service, Liquor/Tobacco, Market Stall/Vending, MTOP/TODA, Sign, and
-- the standalone Barangay Clearance for Tricycles (TODA).
--
-- Each renewal type routes through the EXACT SAME offices as its base permit type (same
-- office_code sequence, reworded step labels) — no new office is introduced. Required documents
-- are the applicant's own prior-approved-permit outputs ("Previous ..."), pre-filled at
-- submission from their last approved application of the base type where one exists (see
-- applications.php create_v2 / api/lib/pipeline.php prefill_renewal_documents()).
--
-- Idempotent: permit_types rows guarded by WHERE NOT EXISTS; steps/docs for each type are
-- deleted and re-inserted by name lookup, same as 020.
-- ---------------------------------------------------------------------------

INSERT INTO permit_types (name, description, track, resident_eligible, business_eligible, is_active)
SELECT v.name, v.description, v.track, v.resident_eligible, v.business_eligible, 1
  FROM (
        SELECT 'Food Service (Sanitary) Renewal' AS name,
               'The yearly renewal of your sanitary permit and food establishment clearance. Re-checks staff health cards, water potability test results, and fire safety inspection.' AS description,
               'business' AS track, 0 AS resident_eligible, 1 AS business_eligible
  UNION SELECT 'Liquor/Tobacco License Renewal',
               'The yearly renewal of your liquor and tobacco retailing authority, re-validating police clearance and premises compliance alongside your business permit.',
               'business', 0, 1
  UNION SELECT 'Market Stall/Vending Permit Renewal',
               'The yearly renewal of your public market stall lease or ambulant vending authority, with fees re-assessed and cleared through the City Treasurer.',
               'business', 0, 1
  UNION SELECT 'MTOP/TODA Permit Renewal',
               'The yearly renewal of your Motorized Tricycle Operator''s Permit (MTOP) franchise, verifying continued route compliance, driver licensing, and vehicle registration.',
               'business', 0, 1
  UNION SELECT 'Sign Permit Renewal',
               'The yearly renewal of your outdoor advertising, signboard or billboard permit, verifying structural safety and zoning compliance for existing signage.',
               'business', 0, 1
  UNION SELECT 'Barangay Clearance for Tricycles (TODA) Renewal',
               'The yearly barangay endorsement for continuing tricycle operations within the barangay. Required before renewing your city MTOP/TODA franchise.',
               'barangay_standalone', 1, 0
       ) v
 WHERE NOT EXISTS (SELECT 1 FROM permit_types WHERE name = v.name);

UPDATE permit_types SET description = 'The yearly renewal of your sanitary permit and food establishment clearance. Re-checks staff health cards, water potability test results, and fire safety inspection.' WHERE name = 'Food Service (Sanitary) Renewal' AND (description IS NULL OR description = '');
UPDATE permit_types SET description = 'The yearly renewal of your liquor and tobacco retailing authority, re-validating police clearance and premises compliance alongside your business permit.' WHERE name = 'Liquor/Tobacco License Renewal' AND (description IS NULL OR description = '');
UPDATE permit_types SET description = 'The yearly renewal of your public market stall lease or ambulant vending authority, with fees re-assessed and cleared through the City Treasurer.' WHERE name = 'Market Stall/Vending Permit Renewal' AND (description IS NULL OR description = '');
UPDATE permit_types SET description = 'The yearly renewal of your Motorized Tricycle Operator''s Permit (MTOP) franchise, verifying continued route compliance, driver licensing, and vehicle registration.' WHERE name = 'MTOP/TODA Permit Renewal' AND (description IS NULL OR description = '');
UPDATE permit_types SET description = 'The yearly renewal of your outdoor advertising, signboard or billboard permit, verifying structural safety and zoning compliance for existing signage.' WHERE name = 'Sign Permit Renewal' AND (description IS NULL OR description = '');
UPDATE permit_types SET description = 'The yearly barangay endorsement for continuing tricycle operations within the barangay. Required before renewing your city MTOP/TODA franchise.' WHERE name = 'Barangay Clearance for Tricycles (TODA) Renewal' AND (description IS NULL OR description = '');

-- ---------------------------------------------------------------------------
-- Food Service (Sanitary) Renewal — same route as Food Service
-- ---------------------------------------------------------------------------
DELETE FROM permit_pipeline_steps WHERE permit_type_id = (SELECT id FROM permit_types WHERE name = 'Food Service (Sanitary) Renewal');
DELETE FROM permit_type_documents WHERE permit_type_id = (SELECT id FROM permit_types WHERE name = 'Food Service (Sanitary) Renewal');

INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label, condition_key, condition_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label, s.condition_key, s.condition_label
  FROM permit_types pt
  JOIN (
        SELECT 1.00 AS step_order, 'BARANGAY' AS office_code, 'Barangay Business Clearance (renewal)' AS step_label, NULL AS condition_key, NULL AS condition_label
  UNION SELECT 2.00, 'CHO', 'Sanitary Permit renewal: health cards, water potability recheck', NULL, NULL
  UNION SELECT 3.00, 'BFP', 'Fire Safety Inspection Certificate renewal', NULL, NULL
  UNION SELECT 3.50, 'FDA', 'FDA License to Operate renewal', 'is_manufacturing', 'Does this business manufacture or repack the food it sells (not just serve it)?'
  UNION SELECT 4.00, 'BPLO', 'Mayor''s Permit re-issued', NULL, NULL
       ) s
 WHERE pt.name = 'Food Service (Sanitary) Renewal';

INSERT INTO permit_type_documents (permit_type_id, doc_name, office_code, sort_order)
SELECT pt.id, d.doc_name, d.office_code, d.sort_order
  FROM permit_types pt
  JOIN (
        SELECT 'Previous Barangay Business Clearance' AS doc_name, 'BARANGAY' AS office_code, 1 AS sort_order
  UNION SELECT 'Previous Sanitary Permit', 'CHO', 2
  UNION SELECT 'Previous Fire Safety Inspection Certificate', 'BFP', 3
  UNION SELECT 'Previous Mayor''s Permit (Food Service)', 'BPLO', 4
  UNION SELECT 'Official Receipt of last year''s permit payment', 'BPLO', 5
       ) d
 WHERE pt.name = 'Food Service (Sanitary) Renewal';

-- ---------------------------------------------------------------------------
-- Liquor/Tobacco License Renewal — same route as Liquor/Tobacco License
-- ---------------------------------------------------------------------------
DELETE FROM permit_pipeline_steps WHERE permit_type_id = (SELECT id FROM permit_types WHERE name = 'Liquor/Tobacco License Renewal');
DELETE FROM permit_type_documents WHERE permit_type_id = (SELECT id FROM permit_types WHERE name = 'Liquor/Tobacco License Renewal');

INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label
  FROM permit_types pt
  JOIN (
        SELECT 1.00 AS step_order, 'BPLO' AS office_code, 'Renewal application review' AS step_label
  UNION SELECT 2.00, 'PNP', 'Police clearance renewal'
  UNION SELECT 3.00, 'BPLO', 'License re-issued'
       ) s
 WHERE pt.name = 'Liquor/Tobacco License Renewal';

INSERT INTO permit_type_documents (permit_type_id, doc_name, office_code, sort_order)
SELECT pt.id, d.doc_name, d.office_code, d.sort_order
  FROM permit_types pt
  JOIN (
        SELECT 'Previous Liquor/Tobacco License' AS doc_name, 'BPLO' AS office_code, 1 AS sort_order
  UNION SELECT 'Official Receipt of last year''s permit payment', 'BPLO', 2
  UNION SELECT 'Previous Police Clearance', 'PNP', 3
       ) d
 WHERE pt.name = 'Liquor/Tobacco License Renewal';

-- ---------------------------------------------------------------------------
-- Market Stall/Vending Permit Renewal — same route as Market Stall/Vending Permit
-- ---------------------------------------------------------------------------
DELETE FROM permit_pipeline_steps WHERE permit_type_id = (SELECT id FROM permit_types WHERE name = 'Market Stall/Vending Permit Renewal');
DELETE FROM permit_type_documents WHERE permit_type_id = (SELECT id FROM permit_types WHERE name = 'Market Stall/Vending Permit Renewal');

INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label
  FROM permit_types pt
  JOIN (
        SELECT 1.00 AS step_order, 'BARANGAY' AS office_code, 'Barangay Business Clearance (renewal)' AS step_label
  UNION SELECT 2.00, 'BPLO', 'Market Section review'
  UNION SELECT 3.00, 'TREASURER', 'Stall fee assessed, permit re-issued'
       ) s
 WHERE pt.name = 'Market Stall/Vending Permit Renewal';

INSERT INTO permit_type_documents (permit_type_id, doc_name, office_code, sort_order)
SELECT pt.id, d.doc_name, d.office_code, d.sort_order
  FROM permit_types pt
  JOIN (
        SELECT 'Previous Barangay Business Clearance' AS doc_name, 'BARANGAY' AS office_code, 1 AS sort_order
  UNION SELECT 'Previous Market Stall/Vending Permit', 'BPLO', 2
  UNION SELECT 'Official Receipt of last year''s stall fee', 'TREASURER', 3
       ) d
 WHERE pt.name = 'Market Stall/Vending Permit Renewal';

-- ---------------------------------------------------------------------------
-- MTOP/TODA Permit Renewal — same route as MTOP/TODA Permit
-- ---------------------------------------------------------------------------
DELETE FROM permit_pipeline_steps WHERE permit_type_id = (SELECT id FROM permit_types WHERE name = 'MTOP/TODA Permit Renewal');
DELETE FROM permit_type_documents WHERE permit_type_id = (SELECT id FROM permit_types WHERE name = 'MTOP/TODA Permit Renewal');

INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label
  FROM permit_types pt
  JOIN (
        SELECT 1.00 AS step_order, 'BARANGAY' AS office_code, 'Barangay Clearance for Tricycles (TODA) renewal' AS step_label
  UNION SELECT 1.50, 'LTO', 'Driver''s licence and vehicle registration recheck'
  UNION SELECT 2.00, 'TRAFFIC', 'City Traffic Management Office review'
  UNION SELECT 3.00, 'BPLO', 'MTOP re-issued'
       ) s
 WHERE pt.name = 'MTOP/TODA Permit Renewal';

INSERT INTO permit_type_documents (permit_type_id, doc_name, office_code, sort_order)
SELECT pt.id, d.doc_name, d.office_code, d.sort_order
  FROM permit_types pt
  JOIN (
        SELECT 'Previous Barangay Clearance for Tricycles (TODA)' AS doc_name, 'BARANGAY' AS office_code, 1 AS sort_order
  UNION SELECT 'Previous MTOP Permit', 'BPLO', 2
  UNION SELECT 'Official Receipt of last year''s permit payment', 'BPLO', 3
  UNION SELECT 'Updated Driver''s License', 'LTO', 4
  UNION SELECT 'Updated Vehicle OR/CR', 'LTO', 5
       ) d
 WHERE pt.name = 'MTOP/TODA Permit Renewal';

-- ---------------------------------------------------------------------------
-- Sign Permit Renewal — same route as Sign Permit
-- ---------------------------------------------------------------------------
DELETE FROM permit_pipeline_steps WHERE permit_type_id = (SELECT id FROM permit_types WHERE name = 'Sign Permit Renewal');
DELETE FROM permit_type_documents WHERE permit_type_id = (SELECT id FROM permit_types WHERE name = 'Sign Permit Renewal');

INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label, condition_key, condition_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label, s.condition_key, s.condition_label
  FROM permit_types pt
  JOIN (
        SELECT 1.00 AS step_order, 'BARANGAY' AS office_code, 'Barangay Business Clearance (renewal)' AS step_label, NULL AS condition_key, NULL AS condition_label
  UNION SELECT 2.00, 'CPDO', 'Placement/zoning recheck', NULL, NULL
  UNION SELECT 2.50, 'OBO', 'Structural re-inspection', 'is_structural_sign', 'Is this a free-standing or structural sign (not just a wall-mounted sign board)?'
  UNION SELECT 3.00, 'BPLO', 'Sign Permit re-issued', NULL, NULL
       ) s
 WHERE pt.name = 'Sign Permit Renewal';

INSERT INTO permit_type_documents (permit_type_id, doc_name, office_code, sort_order)
SELECT pt.id, d.doc_name, d.office_code, d.sort_order
  FROM permit_types pt
  JOIN (
        SELECT 'Previous Barangay Business Clearance' AS doc_name, 'BARANGAY' AS office_code, 1 AS sort_order
  UNION SELECT 'Previous Sign Permit', 'BPLO', 2
  UNION SELECT 'Official Receipt of last year''s permit payment', 'BPLO', 3
       ) d
 WHERE pt.name = 'Sign Permit Renewal';

-- ---------------------------------------------------------------------------
-- Barangay Clearance for Tricycles (TODA) Renewal — same single-node route as the base clearance
-- ---------------------------------------------------------------------------
DELETE FROM permit_pipeline_steps WHERE permit_type_id = (SELECT id FROM permit_types WHERE name = 'Barangay Clearance for Tricycles (TODA) Renewal');
DELETE FROM permit_type_documents WHERE permit_type_id = (SELECT id FROM permit_types WHERE name = 'Barangay Clearance for Tricycles (TODA) Renewal');

INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label)
SELECT pt.id, 1.00, 'BARANGAY', 'Issued directly by the barangay'
  FROM permit_types pt
 WHERE pt.name = 'Barangay Clearance for Tricycles (TODA) Renewal';

INSERT INTO permit_type_documents (permit_type_id, doc_name, office_code, sort_order)
SELECT pt.id, d.doc_name, d.office_code, d.sort_order
  FROM permit_types pt
  JOIN (
        SELECT 'Previous Barangay Clearance for Tricycles (TODA)' AS doc_name, 'BARANGAY' AS office_code, 1 AS sort_order
  UNION SELECT 'Vehicle OR/CR', 'BARANGAY', 2
       ) d
 WHERE pt.name = 'Barangay Clearance for Tricycles (TODA) Renewal';

-- ---------------------------------------------------------------------------
-- Senior-citizen quick question (item 1.7) on all six new types — every permit type with a fee
-- gets this, and all six charge their base permit's fee (section 3).
-- ---------------------------------------------------------------------------
INSERT INTO permit_type_conditions (permit_type_id, condition_key, question_label, yes_label, no_label, requires_document, sort_order)
SELECT pt.id, 'senior_citizen', 'Are you a senior citizen?', 'Yes', 'No', 'Senior Citizen ID', 0
  FROM permit_types pt
 WHERE pt.name IN ('Food Service (Sanitary) Renewal', 'Liquor/Tobacco License Renewal', 'Market Stall/Vending Permit Renewal',
                    'MTOP/TODA Permit Renewal', 'Sign Permit Renewal', 'Barangay Clearance for Tricycles (TODA) Renewal')
   AND NOT EXISTS (SELECT 1 FROM permit_type_conditions c WHERE c.permit_type_id = pt.id AND c.condition_key = 'senior_citizen');
