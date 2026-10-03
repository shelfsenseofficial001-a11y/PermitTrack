-- ---------------------------------------------------------------------------
-- 021 — Documents belong to the office that can actually judge them
--
-- Until now any staff account could verify any document on any application, and
-- because the barangay holds the first node of almost every permit, in practice
-- the Barangay Secretary ended up passing judgement on structural drawings,
-- health cards and tax declarations alike.
--
-- That is not the barangay's job. The barangay confirms the applicant and the
-- details are right and forwards the application onward; the office that owns a
-- document is the one that decides it — plans at the Building Official, health
-- papers at the City Health Office, receipts at the Treasurer, and so on.
--
-- Each required document now names its handling office. The assignment is per
-- permit type, not per document name, because the same paper is weighed
-- differently depending on what is being applied for: a Lot Title is the
-- Assessor's business on a Building Permit, but on a Barangay Construction
-- Clearance — a single-node permit — only the barangay is ever involved.
--
-- Every assignment is guaranteed to be an office on that permit's own route.
-- A document owned by an office that never sees the application could never be
-- reviewed, which would stall the permit forever.
--
-- Idempotent: the column is added only if absent, and the assignments are
-- straight UPDATEs keyed on permit and document name.
-- ---------------------------------------------------------------------------

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'permit_type_documents' AND COLUMN_NAME = 'office_code');
SET @sql := IF(@col = 0,
    'ALTER TABLE permit_type_documents ADD COLUMN office_code VARCHAR(20) NULL AFTER doc_name',
    'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- The same stamp on the application's own copy, so a document keeps its handler
-- even if the catalogue is re-pointed later (the pipeline snapshots its steps
-- the same way).
SET @col2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_documents' AND COLUMN_NAME = 'office_code');
SET @sql2 := IF(@col2 = 0,
    'ALTER TABLE application_documents ADD COLUMN office_code VARCHAR(20) NULL AFTER doc_name',
    'DO 0');
PREPARE s2 FROM @sql2; EXECUTE s2; DEALLOCATE PREPARE s2;

-- ---------------------------------------------------------------------------
-- Who owns what
-- ---------------------------------------------------------------------------
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Business Clearance (New)' AND d.doc_name = 'Valid Government ID';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Business Clearance (New)' AND d.doc_name = 'Lease Contract or Land Title';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Business Clearance (New)' AND d.doc_name = 'DTI/SEC/CDA Registration';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Business Clearance (Renewal)' AND d.doc_name = 'Valid Government ID';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Business Clearance (Renewal)' AND d.doc_name = 'Previous Barangay Clearance';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Clearance (Personal)' AND d.doc_name = 'Valid Government ID';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Clearance for Special Events' AND d.doc_name = 'Valid Government ID';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Clearance for Special Events' AND d.doc_name = 'Event Details / Program';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Clearance for Tricycles (TODA)' AND d.doc_name = 'Valid Government ID';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Clearance for Tricycles (TODA)' AND d.doc_name = 'Vehicle OR/CR';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Construction Clearance' AND d.doc_name = 'Valid Government ID';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Construction Clearance' AND d.doc_name = 'Lot Title or Tax Declaration';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Construction Clearance' AND d.doc_name = 'Building Plan Sketch';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Demolition Clearance' AND d.doc_name = 'Valid Government ID';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Demolition Clearance' AND d.doc_name = 'Proof of Ownership';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Employment Clearance' AND d.doc_name = 'Valid Government ID';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Employment Clearance' AND d.doc_name = 'Job Offer Letter';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Excavation/Road-Cut Clearance' AND d.doc_name = 'Valid Government ID';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Excavation/Road-Cut Clearance' AND d.doc_name = 'Site Sketch';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Fencing Clearance' AND d.doc_name = 'Valid Government ID';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Barangay Fencing Clearance' AND d.doc_name = 'Lot Title or Tax Declaration';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'OBO'
 WHERE pt.name = 'Building Permit' AND d.doc_name = 'Site Plan';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'OBO'
 WHERE pt.name = 'Building Permit' AND d.doc_name = 'Structural Drawings';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'ASSESSOR'
 WHERE pt.name = 'Building Permit' AND d.doc_name = 'Lot Title or Tax Declaration';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'OBO'
 WHERE pt.name = 'Building Permit' AND d.doc_name = 'Contractor License';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BPLO'
 WHERE pt.name = 'Business License' AND d.doc_name = 'Business Formation Document (DTI / SEC / CDA)';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BPLO'
 WHERE pt.name = 'Business License' AND d.doc_name = 'BIR Certificate of Registration (Form 2303)';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'CPDO'
 WHERE pt.name = 'Business License' AND d.doc_name = 'Zoning Compliance Letter';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BPLO'
 WHERE pt.name = 'Business Permit Renewal' AND d.doc_name = 'Previous Mayor\'s / Business Permit';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'TREASURER'
 WHERE pt.name = 'Business Permit Renewal' AND d.doc_name = 'Official Receipt of last year\'s permit payment';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Business Permit Renewal' AND d.doc_name = 'Previous Barangay Business Clearance';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BPLO'
 WHERE pt.name = 'Business Permit Renewal' AND d.doc_name = 'Certified gross sales / receipts summary (previous year)';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Certificate of Good Moral Character' AND d.doc_name = 'Valid Government ID';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Certificate of Indigency' AND d.doc_name = 'Valid Government ID';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Certificate of Residency' AND d.doc_name = 'Valid Government ID';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Certificate of Residency' AND d.doc_name = 'Proof of Address';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Certificate to File Action' AND d.doc_name = 'Valid Government ID';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Certificate to File Action' AND d.doc_name = 'Mediation Records (Lupon)';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'OBO'
 WHERE pt.name = 'Demolition Permit' AND d.doc_name = 'Demolition Plan';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'OBO'
 WHERE pt.name = 'Demolition Permit' AND d.doc_name = 'Proof of Ownership';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'ENGINEER'
 WHERE pt.name = 'Excavation/Road-Cut Permit' AND d.doc_name = 'Excavation Plan';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'ENGINEER'
 WHERE pt.name = 'Excavation/Road-Cut Permit' AND d.doc_name = 'Utility Company Authorization (if applicable)';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'OBO'
 WHERE pt.name = 'Fencing Permit' AND d.doc_name = 'Fencing Plan / Sketch';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'OBO'
 WHERE pt.name = 'Fencing Permit' AND d.doc_name = 'Lot Title or Tax Declaration';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'First-Time Jobseeker Certificate' AND d.doc_name = 'Valid Government ID';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'First-Time Jobseeker Certificate' AND d.doc_name = 'Certificate of Residency';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'CHO'
 WHERE pt.name = 'Food Service' AND d.doc_name = 'Health Permit Application';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'CHO'
 WHERE pt.name = 'Food Service' AND d.doc_name = 'Food Handler Certificate';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'CHO'
 WHERE pt.name = 'Food Service' AND d.doc_name = 'Floor Plan';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BFP'
 WHERE pt.name = 'Food Service' AND d.doc_name = 'Proof of Insurance';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BPLO'
 WHERE pt.name = 'Liquor/Tobacco License' AND d.doc_name = 'Copy of Business/Mayor\'s Permit';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'TREASURER'
 WHERE pt.name = 'Market Stall/Vending Permit' AND d.doc_name = 'Community Tax Certificate (Cedula)';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BARANGAY'
 WHERE pt.name = 'Market Stall/Vending Permit' AND d.doc_name = 'Health Card';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'TRAFFIC'
 WHERE pt.name = 'MTOP/TODA Permit' AND d.doc_name = 'Driver\'s License';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'TRAFFIC'
 WHERE pt.name = 'MTOP/TODA Permit' AND d.doc_name = 'Vehicle OR/CR';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'OBO'
 WHERE pt.name = 'Occupancy Permit' AND d.doc_name = 'As-Built Plans';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'OBO'
 WHERE pt.name = 'Occupancy Permit' AND d.doc_name = 'Certificate of Completion';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'CPDO'
 WHERE pt.name = 'Sign Permit' AND d.doc_name = 'Sign Drawing / Rendering';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'CPDO'
 WHERE pt.name = 'Sign Permit' AND d.doc_name = 'Property Owner Authorization';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BFP'
 WHERE pt.name = 'Special Event' AND d.doc_name = 'Event Layout Map';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'BFP'
 WHERE pt.name = 'Special Event' AND d.doc_name = 'Proof of Insurance';
UPDATE permit_type_documents d JOIN permit_types pt ON pt.id = d.permit_type_id
   SET d.office_code = 'PNP'
 WHERE pt.name = 'Special Event' AND d.doc_name = 'Security/Safety Plan';

-- Documents already uploaded take the handler their permit type now names. The
-- barangay keeps anything the catalogue cannot place, which is the same office
-- that would have been handling it before this migration.
UPDATE application_documents ad
  JOIN applications a ON a.id = ad.application_id
  LEFT JOIN permit_type_documents ptd
         ON ptd.permit_type_id = a.permit_type_id AND ptd.doc_name = ad.doc_name
   SET ad.office_code = COALESCE(ptd.office_code, 'BARANGAY')
 WHERE ad.office_code IS NULL;
