-- 011: Required documents per permit type (27-type catalog).
--
-- The old required_documents_for() in api/config.php is a hardcoded PHP array keyed by the
-- 5-value legacy enum — it has no entries for the 22 new permit types, so NewApplication.js's
-- new catalog flow (create_v2) collected no documents at all. This table is the data-driven
-- replacement, consistent with how permit_types/permit_pipeline_steps already moved off hardcoded
-- PHP arrays. See BREAKING_CHANGES.md.
--
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/011_permit_type_documents.sql

USE permittrack;

CREATE TABLE IF NOT EXISTS permit_type_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    permit_type_id INT NOT NULL,
    doc_name VARCHAR(150) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    FOREIGN KEY (permit_type_id) REFERENCES permit_types(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Construction track
INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (
    SELECT 1 sort_order, 'Site Plan' doc_name UNION ALL SELECT 2, 'Structural Drawings'
    UNION ALL SELECT 3, 'Lot Title or Tax Declaration' UNION ALL SELECT 4, 'Contractor License'
) d ON 1=1
WHERE pt.name = 'Building Permit' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (
    SELECT 1 sort_order, 'As-Built Plans' doc_name UNION ALL SELECT 2, 'Certificate of Completion'
) d ON 1=1
WHERE pt.name = 'Occupancy Permit' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (
    SELECT 1 sort_order, 'Fencing Plan / Sketch' doc_name UNION ALL SELECT 2, 'Lot Title or Tax Declaration'
) d ON 1=1
WHERE pt.name = 'Fencing Permit' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (
    SELECT 1 sort_order, 'Demolition Plan' doc_name UNION ALL SELECT 2, 'Proof of Ownership'
) d ON 1=1
WHERE pt.name = 'Demolition Permit' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (
    SELECT 1 sort_order, 'Excavation Plan' doc_name UNION ALL SELECT 2, 'Utility Company Authorization (if applicable)'
) d ON 1=1
WHERE pt.name = 'Excavation/Road-Cut Permit' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

-- Business track
INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (
    SELECT 1 sort_order, 'Business Formation Document (DTI / SEC / CDA)' doc_name
    UNION ALL SELECT 2, 'BIR Certificate of Registration (Form 2303)'
    UNION ALL SELECT 3, 'Zoning Compliance Letter'
) d ON 1=1
WHERE pt.name = 'Business License' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (
    SELECT 1 sort_order, 'Health Permit Application' doc_name UNION ALL SELECT 2, 'Food Handler Certificate'
    UNION ALL SELECT 3, 'Floor Plan' UNION ALL SELECT 4, 'Proof of Insurance'
) d ON 1=1
WHERE pt.name = 'Food Service' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (
    SELECT 1 sort_order, 'Sign Drawing / Rendering' doc_name UNION ALL SELECT 2, 'Property Owner Authorization'
) d ON 1=1
WHERE pt.name = 'Sign Permit' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (
    SELECT 1 sort_order, 'Event Layout Map' doc_name UNION ALL SELECT 2, 'Proof of Insurance'
    UNION ALL SELECT 3, 'Security/Safety Plan'
) d ON 1=1
WHERE pt.name = 'Special Event' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (
    SELECT 1 sort_order, 'Copy of Business/Mayor\'s Permit' doc_name
) d ON 1=1
WHERE pt.name = 'Liquor/Tobacco License' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (
    SELECT 1 sort_order, 'Driver\'s License' doc_name UNION ALL SELECT 2, 'Vehicle OR/CR'
) d ON 1=1
WHERE pt.name = 'MTOP/TODA Permit' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (
    SELECT 1 sort_order, 'Community Tax Certificate (Cedula)' doc_name UNION ALL SELECT 2, 'Health Card'
) d ON 1=1
WHERE pt.name = 'Market Stall/Vending Permit' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

-- Personal / barangay-only track (all resident-filed, so a valid ID is the common baseline)
INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, 'Valid Government ID', 1 FROM permit_types pt
WHERE pt.name = 'Barangay Clearance (Personal)' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (SELECT 1 sort_order, 'Valid Government ID' doc_name UNION ALL SELECT 2, 'Job Offer Letter') d ON 1=1
WHERE pt.name = 'Barangay Employment Clearance' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, 'Valid Government ID', 1 FROM permit_types pt
WHERE pt.name = 'Certificate of Good Moral Character' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, 'Valid Government ID', 1 FROM permit_types pt
WHERE pt.name = 'Certificate of Indigency' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (SELECT 1 sort_order, 'Valid Government ID' doc_name UNION ALL SELECT 2, 'Proof of Address') d ON 1=1
WHERE pt.name = 'Certificate of Residency' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (SELECT 1 sort_order, 'Valid Government ID' doc_name UNION ALL SELECT 2, 'Mediation Records (Lupon)') d ON 1=1
WHERE pt.name = 'Certificate to File Action' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (SELECT 1 sort_order, 'Valid Government ID' doc_name UNION ALL SELECT 2, 'Certificate of Residency') d ON 1=1
WHERE pt.name = 'First-Time Jobseeker Certificate' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

-- Standalone barangay clearances (dual-purpose with their city-permit siblings)
INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (SELECT 1 sort_order, 'Valid Government ID' doc_name UNION ALL SELECT 2, 'Lease Contract or Land Title'
      UNION ALL SELECT 3, 'DTI/SEC/CDA Registration') d ON 1=1
WHERE pt.name = 'Barangay Business Clearance (New)' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (SELECT 1 sort_order, 'Valid Government ID' doc_name UNION ALL SELECT 2, 'Previous Barangay Clearance') d ON 1=1
WHERE pt.name = 'Barangay Business Clearance (Renewal)' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (SELECT 1 sort_order, 'Valid Government ID' doc_name UNION ALL SELECT 2, 'Event Details / Program') d ON 1=1
WHERE pt.name = 'Barangay Clearance for Special Events' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (SELECT 1 sort_order, 'Valid Government ID' doc_name UNION ALL SELECT 2, 'Vehicle OR/CR') d ON 1=1
WHERE pt.name = 'Barangay Clearance for Tricycles (TODA)' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (SELECT 1 sort_order, 'Valid Government ID' doc_name UNION ALL SELECT 2, 'Lot Title or Tax Declaration'
      UNION ALL SELECT 3, 'Building Plan Sketch') d ON 1=1
WHERE pt.name = 'Barangay Construction Clearance' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (SELECT 1 sort_order, 'Valid Government ID' doc_name UNION ALL SELECT 2, 'Proof of Ownership') d ON 1=1
WHERE pt.name = 'Barangay Demolition Clearance' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (SELECT 1 sort_order, 'Valid Government ID' doc_name UNION ALL SELECT 2, 'Site Sketch') d ON 1=1
WHERE pt.name = 'Barangay Excavation/Road-Cut Clearance' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);

INSERT INTO permit_type_documents (permit_type_id, doc_name, sort_order)
SELECT pt.id, d.doc_name, d.sort_order FROM permit_types pt
JOIN (SELECT 1 sort_order, 'Valid Government ID' doc_name UNION ALL SELECT 2, 'Lot Title or Tax Declaration') d ON 1=1
WHERE pt.name = 'Barangay Fencing Clearance' AND NOT EXISTS (SELECT 1 FROM permit_type_documents e WHERE e.permit_type_id = pt.id);
