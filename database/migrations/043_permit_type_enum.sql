-- ---------------------------------------------------------------------------
-- 043 -- Expand applications.permit_type ENUM to cover all catalog and renewal permit types
--
-- Idempotent: checks information_schema.COLUMNS before altering.
-- ---------------------------------------------------------------------------

SET @e := (SELECT COLUMN_TYPE FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'permit_type');
SET @s := IF(@e NOT LIKE '%Barangay Clearance for Tricycles (TODA) Renewal%',
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
    'Sign Permit Renewal','Barangay Clearance for Tricycles (TODA) Renewal'
  ) NULL",
  'DO 0');
PREPARE s FROM @s; EXECUTE s; DEALLOCATE PREPARE s;
