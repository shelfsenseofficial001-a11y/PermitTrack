-- ---------------------------------------------------------------------------
-- 023 — Drop the LTO's own transactions; keep the city permit
--
-- 022 added driver's licence renewal, student permits, new licences and motor
-- vehicle registration renewal. That was a mistake: the LTO runs all four
-- through its own portal (LTMS), so putting them here duplicates a service that
-- already exists and would leave applicants wondering which one counts.
--
-- What belongs in PermitTrack is the permit the CITY issues: the MTOP, the
-- Motorized Tricycle Operator's Permit, granted by the city through BPLO with
-- the barangay and the Traffic Management Office. That permit already existed
-- and stays.
--
-- The LTO office itself stays too, with its one node on the MTOP route: the
-- driver's licence and the vehicle's OR/CR are LTO papers, and 022 moved them
-- off the city's Traffic office, which does not issue either. That is the only
-- thing the LTO does here — it validates its own documents on a city permit,
-- the same co-routed arrangement the FDA has on Food Service.
--
-- Safe: nothing had been filed against any of the four (checked before writing).
-- Idempotent: re-running removes nothing further.
-- ---------------------------------------------------------------------------

DELETE FROM permit_pipeline_steps
 WHERE permit_type_id IN (
       SELECT id FROM permit_types
        WHERE name IN ('Driver''s License Renewal', 'Student Permit',
                       'Driver''s License (New)', 'Motor Vehicle Registration Renewal')
   );

DELETE FROM permit_type_documents
 WHERE permit_type_id IN (
       SELECT id FROM permit_types
        WHERE name IN ('Driver''s License Renewal', 'Student Permit',
                       'Driver''s License (New)', 'Motor Vehicle Registration Renewal')
   );

DELETE FROM permit_types
 WHERE name IN ('Driver''s License Renewal', 'Student Permit',
                'Driver''s License (New)', 'Motor Vehicle Registration Renewal')
   AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.permit_type_id = permit_types.id);
