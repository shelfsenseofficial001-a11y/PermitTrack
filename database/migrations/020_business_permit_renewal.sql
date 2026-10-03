-- ---------------------------------------------------------------------------
-- 020 — Business Permit Renewal
--
-- PermitTrack records businesses that already exist and already trade in
-- Dasmariñas; it is not where a business is formed. Forming one happens at the
-- DTI, SEC or CDA and is outside this system entirely — and those registrations
-- do not expire yearly anyway (DTI runs 5 years, SEC is one-time). What the city
-- issues and re-issues is the permit to operate, so alongside "Business License"
-- (the first-time permit) there is now the yearly renewal, which is the path
-- most businesses already on the system will actually take.
--
-- Permits lapse on 31 December and are renewed between 1 and 20 January. Renewing
-- late carries a 25% surcharge plus 2% monthly interest on the local business tax,
-- which is why the renewal is its own permit type rather than a note on the first-
-- time one.
--
-- Renewal skips zoning: the location was cleared when the business first
-- registered and has not moved. It keeps the health and fire steps, because the
-- Sanitary Permit, staff health cards and the FSIC are all issued annually and
-- the Mayor's Permit cannot be released without current ones.
--
-- Idempotent, and self-correcting: the steps and documents are rebuilt from this
-- file each run, so editing the pipeline here and re-running is enough. Safe
-- because applications copy their steps into application_pipeline_progress at
-- submission rather than pointing back at these rows.
-- ---------------------------------------------------------------------------

INSERT INTO permit_types (name, track, resident_eligible, business_eligible, is_active)
SELECT 'Business Permit Renewal', 'business', 0, 1, 1
 WHERE NOT EXISTS (SELECT 1 FROM permit_types WHERE name = 'Business Permit Renewal');

DELETE FROM permit_pipeline_steps
 WHERE permit_type_id = (SELECT id FROM permit_types WHERE name = 'Business Permit Renewal');

DELETE FROM permit_type_documents
 WHERE permit_type_id = (SELECT id FROM permit_types WHERE name = 'Business Permit Renewal');

-- The offices that sign off, in the order a renewal actually moves through them:
-- the barangay first (it is a prerequisite for everything after it), then the
-- city offices, then payment, and BPLO releases the permit at the end. Every step
-- is unconditional — a renewal asks no branch questions, which is part of why it
-- is the simpler of the two paths.
INSERT INTO permit_pipeline_steps (permit_type_id, step_order, office_code, step_label)
SELECT pt.id, s.step_order, s.office_code, s.step_label
  FROM permit_types pt
  JOIN (
        SELECT 1.00 AS step_order, 'BARANGAY'  AS office_code, 'Barangay Business Clearance (Renewal)'            AS step_label
  UNION SELECT 2.00,              'BPLO',                      'Renewal assessment: gross receipts and local business tax'
  UNION SELECT 3.00,              'CHO',                       'Sanitary Permit and staff health cards'
  UNION SELECT 4.00,              'BFP',                       'Fire Safety Inspection Certificate'
  UNION SELECT 5.00,              'TREASURER',                 'Community Tax Certificate (Cedula) and payment'
  UNION SELECT 6.00,              'BPLO',                      'Mayor''s Permit re-issued'
       ) s
 WHERE pt.name = 'Business Permit Renewal';

-- What the applicant brings. All of it is evidence the business operated last year
-- and settled what it owed: the expiring permit and its receipt, the barangay
-- clearance being replaced, and the gross receipts the new tax is computed from.
-- Formation papers (DTI/SEC/CDA, BIR 2303) are not re-asked — they are already on
-- the business record and do not expire yearly.
INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order
  FROM permit_types pt
  JOIN (
        SELECT 'Previous Mayor''s / Business Permit'                       AS doc_name, 1 AS sort_order
  UNION SELECT 'Official Receipt of last year''s permit payment',                2
  UNION SELECT 'Previous Barangay Business Clearance',                           3
  UNION SELECT 'Certified gross sales / receipts summary (previous year)',       4
       ) d
 WHERE pt.name = 'Business Permit Renewal';
