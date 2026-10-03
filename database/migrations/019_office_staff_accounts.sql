-- ---------------------------------------------------------------------------
-- 019 — One staff account per reviewing office
--
-- Migration 008 gave every barangay secretariat a seeded account, but none of
-- the city/national offices got one. Every permit that leaves the barangay
-- (Building, Occupancy, Fencing, Demolition, Excavation, Business License,
-- Food Service, Sign, Special Event, Liquor/Tobacco, MTOP/TODA, Market Stall)
-- therefore stalls at its second step with nobody able to act on it.
--
-- One account per office, not per permit and not per area: the office code in
-- permit_pipeline_steps is what routing keys on, so a single OBO account covers
-- every permit that routes to OBO, and likewise for the rest.
--
-- Idempotent: re-running adds nothing.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Put OBO, BPLO and CHO on the pipeline, like every other office
--
-- These three still carried the pre-008 CSV of permit type names. That CSV is
-- what is_pipeline_staff() keys on (api/config.php), so their staff would be
-- handed the legacy queue — which filters on applications.permit_type, a column
-- that is NULL for every application filed through the current form. The result
-- is an empty queue for the three busiest offices in the pipeline. Everything
-- routes by office_code now, so the CSV has nothing left to say.
-- ---------------------------------------------------------------------------
UPDATE departments
   SET permit_types = '__unassigned__'
 WHERE code IN ('OBO', 'BPLO', 'CHO')
   AND permit_types <> '__unassigned__';

-- ---------------------------------------------------------------------------
-- 2. One staff account per city/national office
--
-- Same demo password as the seeded barangay accounts (Password123!) and the
-- same .demo email domain, so none of these can collide with a real mailbox.
-- Barangay secretariats are skipped — 008 already covered all 75 of them.
-- ---------------------------------------------------------------------------
INSERT INTO users (role, account_type, department_id, email, password_hash,
                   full_name, first_name, last_name, onboarding_completed, email_verified_at)
SELECT 'staff',
       'staff',
       d.id,
       o.email,
       '$2y$10$hmPWXOOOOcky2Ev1RKOi/.6ZJUJiQvGWB4Zaf1PDMPUd87yLsMtHu',
       o.full_name,
       o.first_name,
       o.last_name,
       1,
       NOW()
  FROM departments d
  JOIN (
        SELECT 'OBO'       AS code, 'obo@dasmarinas.gov.ph.demo'       AS email, 'Building Official — OBO'                AS full_name, 'Building'      AS first_name, 'Official'   AS last_name
  UNION SELECT 'BPLO',           'bplo@dasmarinas.gov.ph.demo',            'Licensing Officer — BPLO',                    'Licensing',    'Officer'
  UNION SELECT 'CHO',            'cho@dasmarinas.gov.ph.demo',             'Sanitary Inspector — City Health Office',      'Sanitary',     'Inspector'
  UNION SELECT 'CPDO',           'cpdo@dasmarinas.gov.ph.demo',            'Zoning Officer — CPDO',                       'Zoning',       'Officer'
  UNION SELECT 'BFP',            'bfp@dasmarinas.gov.ph.demo',             'Fire Safety Inspector — BFP',                 'Fire Safety',  'Inspector'
  UNION SELECT 'CENRO',          'cenro@dasmarinas.gov.ph.demo',           'Environmental Officer — CENRO',               'Environmental','Officer'
  UNION SELECT 'ASSESSOR',       'assessor@dasmarinas.gov.ph.demo',        'Assessment Officer — City Assessor',          'Assessment',   'Officer'
  UNION SELECT 'TREASURER',      'treasurer@dasmarinas.gov.ph.demo',       'Revenue Officer — City Treasurer',            'Revenue',      'Officer'
  UNION SELECT 'ENGINEER',       'engineer@dasmarinas.gov.ph.demo',        'City Engineer — Public Works',                'City',         'Engineer'
  UNION SELECT 'PNP',            'pnp@dasmarinas.gov.ph.demo',             'Police Coordinator — PNP',                    'Police',       'Coordinator'
  UNION SELECT 'TRAFFIC',        'traffic@dasmarinas.gov.ph.demo',         'Traffic Officer — TODA Section',              'Traffic',      'Officer'
  UNION SELECT 'FDA',            'fda@dasmarinas.gov.ph.demo',             'Licensing Officer — FDA',                     'Licensing',    'Officer (FDA)'
       ) o ON o.code = d.code
 WHERE NOT EXISTS (
       SELECT 1 FROM users u WHERE u.department_id = d.id AND u.role IN ('staff', 'admin')
   )
   AND NOT EXISTS (
       SELECT 1 FROM users u2 WHERE u2.email = o.email
   );
