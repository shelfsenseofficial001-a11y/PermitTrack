-- ---------------------------------------------------------------------------
-- 022 — Land Transportation Office
--
-- The LTO is a national agency, not a city office, and a driver's licence is not
-- a city permit: licensing and motor-vehicle registration are handled at an LTO
-- district office, not at Dasmariñas City Hall. PermitTrack tracks them the same
-- way it already tracks the FDA — as a co-routed national office — so an
-- applicant can follow one queue instead of several.
--
-- This migration:
--   1. adds the LTO as a department, with the one account that office uses,
--   2. adds the licensing and registration transactions it actually runs,
--   3. puts LTO on the MTOP/TODA route and hands it the two documents there that
--      were only ever LTO's to judge — the licence and the vehicle's OR/CR.
--
-- (3) is the case from the brief: the barangay confirms the applicant's details
-- and forwards, and the LTO decides the LTO paperwork.
--
-- Idempotent: re-running adds nothing.
-- ---------------------------------------------------------------------------

INSERT INTO departments (name, code, description, permit_types)
SELECT 'Land Transportation Office — Dasmariñas District',
       'LTO',
       'Driver licensing and motor vehicle registration (national, co-routed)',
       '__unassigned__'
 WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'LTO');

-- One account, like every other office. The password hash is copied from an
-- existing office account so this one is never out of step with the rest —
-- nothing is hard-coded here, and the wrapper subquery is what lets MySQL read
-- from `users` while inserting into it.
INSERT INTO users (role, account_type, department_id, email, password_hash,
                   full_name, first_name, last_name, onboarding_completed, email_verified_at)
SELECT 'staff', 'staff', d.id,
       'lto@dasmarinas.gov.ph.demo',
       (SELECT h FROM (SELECT password_hash AS h FROM users
                        WHERE role = 'staff' AND is_active = 1 AND department_id IS NOT NULL
                        ORDER BY id LIMIT 1) AS src),
       'Licensing Officer — LTO', 'Licensing', 'Officer (LTO)', 1, NOW()
  FROM departments d
 WHERE d.code = 'LTO'
   AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email = 'lto@dasmarinas.gov.ph.demo');

-- ---------------------------------------------------------------------------
-- The transactions the LTO runs. Personal track: these belong to a person, not
-- to a business, so a resident can file them without registering a business.
-- Each route is LTO end to end, because the LTO does not hand these to the city.
-- ---------------------------------------------------------------------------
INSERT INTO permit_types (name, track, resident_eligible, business_eligible, is_active)
SELECT t.name, 'personal', 1, 0, 1
  FROM (
        SELECT 'Driver''s License Renewal'            AS name
  UNION SELECT 'Student Permit'
  UNION SELECT 'Driver''s License (New)'
  UNION SELECT 'Motor Vehicle Registration Renewal'
       ) t
 WHERE NOT EXISTS (SELECT 1 FROM permit_types p WHERE p.name = t.name);

-- Rebuilt from this file on each run, so the routes can be edited here.
DELETE FROM permit_pipeline_steps
 WHERE permit_type_id IN (SELECT id FROM permit_types
          WHERE name IN ('Driver''s License Renewal','Student Permit','Driver''s License (New)','Motor Vehicle Registration Renewal'));

DELETE FROM permit_type_documents
 WHERE permit_type_id IN (SELECT id FROM permit_types
          WHERE name IN ('Driver''s License Renewal','Student Permit','Driver''s License (New)','Motor Vehicle Registration Renewal'));

INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label)
SELECT pt.id, s.step_order, 'LTO', s.step_label
  FROM permit_types pt
  JOIN (
        SELECT 'Driver''s License Renewal' AS permit, 1.00 AS step_order, 'Medical certificate and application review' AS step_label
  UNION SELECT 'Driver''s License Renewal', 2.00, 'Comprehensive Driver''s Education seminar'
  UNION SELECT 'Driver''s License Renewal', 3.00, 'Licence card issued'

  UNION SELECT 'Student Permit',            1.00, 'Medical certificate and application review'
  UNION SELECT 'Student Permit',            2.00, 'Theoretical Driving Course completed'
  UNION SELECT 'Student Permit',            3.00, 'Student Permit issued'

  UNION SELECT 'Driver''s License (New)',   1.00, 'Student Permit and medical certificate review'
  UNION SELECT 'Driver''s License (New)',   2.00, 'Practical Driving Course and examinations'
  UNION SELECT 'Driver''s License (New)',   3.00, 'Licence card issued'

  UNION SELECT 'Motor Vehicle Registration Renewal', 1.00, 'Motor Vehicle Inspection (MVIS)'
  UNION SELECT 'Motor Vehicle Registration Renewal', 2.00, 'Emission test and CTPL insurance check'
  UNION SELECT 'Motor Vehicle Registration Renewal', 3.00, 'Certificate of Registration re-issued'
       ) s ON s.permit = pt.name;

-- Every document here is the LTO's to judge; no other office is on these routes.
INSERT INTO permit_type_documents (permit_type_id, doc_name, office_code, sort_order)
SELECT pt.id, d.doc_name, 'LTO', d.sort_order
  FROM permit_types pt
  JOIN (
        SELECT 'Driver''s License Renewal' AS permit, 'Current or Expired Driver''s License' AS doc_name, 1 AS sort_order
  UNION SELECT 'Driver''s License Renewal', 'LTO Medical Certificate', 2
  UNION SELECT 'Driver''s License Renewal', 'Comprehensive Driver''s Education (CDE) Certificate', 3

  UNION SELECT 'Student Permit',            'Valid Government ID', 1
  UNION SELECT 'Student Permit',            'PSA Birth Certificate', 2
  UNION SELECT 'Student Permit',            'LTO Medical Certificate', 3

  UNION SELECT 'Driver''s License (New)',   'Student Permit (held at least one month)', 1
  UNION SELECT 'Driver''s License (New)',   'LTO Medical Certificate', 2
  UNION SELECT 'Driver''s License (New)',   'Practical Driving Course Certificate', 3

  UNION SELECT 'Motor Vehicle Registration Renewal', 'Previous Certificate of Registration (CR)', 1
  UNION SELECT 'Motor Vehicle Registration Renewal', 'Previous Official Receipt (OR)', 2
  UNION SELECT 'Motor Vehicle Registration Renewal', 'Certificate of Emission Compliance', 3
  UNION SELECT 'Motor Vehicle Registration Renewal', 'CTPL Insurance Policy', 4
       ) d ON d.permit = pt.name;

-- ---------------------------------------------------------------------------
-- MTOP/TODA: the licence and the OR/CR were being judged by the city's Traffic
-- Management Office, which does not issue either of them. LTO joins the route
-- between the barangay and Traffic, and takes those two documents.
-- ---------------------------------------------------------------------------
INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label)
SELECT pt.id, 1.50, 'LTO', 'Driver''s licence and vehicle registration check'
  FROM permit_types pt
 WHERE pt.name = 'MTOP/TODA Permit'
   AND NOT EXISTS (
       SELECT 1 FROM permit_pipeline_steps s
        WHERE s.permit_type_id = pt.id AND s.office_code = 'LTO'
   );

UPDATE permit_type_documents d
  JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'LTO'
 WHERE pt.name = 'MTOP/TODA Permit'
   AND d.doc_name IN ('Driver''s License', 'Vehicle OR/CR');

-- Applications already in flight keep whatever their own snapshot says; only the
-- catalogue changes here.
