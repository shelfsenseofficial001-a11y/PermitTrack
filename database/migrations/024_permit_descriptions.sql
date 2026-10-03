-- ---------------------------------------------------------------------------
-- 024 — What each permit is for
--
-- The catalogue listed 28 names and nothing else, so choosing between "Business
-- License" and "Business Permit Renewal", or between a Barangay Construction
-- Clearance and a Building Permit, meant already knowing the answer. Each type
-- now carries a plain description: what it covers, and when you need it.
--
-- Deliberately not a list of offices — the route is already drawn from
-- permit_pipeline_steps and would go stale here the moment a route changed.
--
-- Idempotent: the column is added only if absent, and the text is set by name.
-- ---------------------------------------------------------------------------

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'permit_types' AND COLUMN_NAME = 'description');
SET @sql := IF(@col = 0,
    'ALTER TABLE permit_types ADD COLUMN description VARCHAR(400) NULL AFTER name',
    'DO 0');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------------
-- Construction
-- ---------------------------------------------------------------------------
UPDATE permit_types SET description =
 'Required before you build, add to, or structurally alter a building. Covers the plans, the lot, environmental impact and unpaid property tax, so it is the longest route in the system — expect several offices and a site inspection.'
 WHERE name = 'Building Permit';

UPDATE permit_types SET description =
 'Required before taking down a structure, in whole or in part. The city checks who owns it, how it will come down safely, and what happens to the debris.'
 WHERE name = 'Demolition Permit';

UPDATE permit_types SET description =
 'Required before digging in or cutting into a public road, sidewalk or easement — usually for a water, power or drainage connection. Covers how the road gets restored afterwards.'
 WHERE name = 'Excavation/Road-Cut Permit';

UPDATE permit_types SET description =
 'Required before putting up a perimeter fence or wall. Lighter than a Building Permit, but still checks the boundary, the height and any drainage or waterway it might affect.'
 WHERE name = 'Fencing Permit';

UPDATE permit_types SET description =
 'The last step after construction finishes: proof the building was finished to the approved plans and is safe to use. A building cannot legally be occupied without it, and it starts at the Building Official rather than your barangay.'
 WHERE name = 'Occupancy Permit';

-- ---------------------------------------------------------------------------
-- Business
-- ---------------------------------------------------------------------------
UPDATE permit_types SET description =
 'The first-time Mayor''s Permit for a business that has never been licensed by the city. Checks that what you do is allowed where you are, then assesses your local business tax. Renewing an existing permit is a different application.'
 WHERE name = 'Business License';

UPDATE permit_types SET description =
 'The yearly renewal of an existing Mayor''s Permit. Permits lapse on 31 December and renewal runs 1–20 January; renewing later adds a 25% surcharge plus 2% interest a month. Zoning is not re-checked, but health, fire and your gross receipts are.'
 WHERE name = 'Business Permit Renewal';

UPDATE permit_types SET description =
 'For any business that prepares, serves or sells food. Adds a sanitary permit, water potability and staff health cards on top of the usual licensing, and a fire inspection. Food manufacturers are also routed to the FDA.'
 WHERE name = 'Food Service';

UPDATE permit_types SET description =
 'Permission to sell liquor or tobacco, on top of your business permit. Includes a police clearance, and is tied to the premises named on the application.'
 WHERE name = 'Liquor/Tobacco License';

UPDATE permit_types SET description =
 'For selling from a stall in a public market or as an ambulant vendor. Lighter than a full business licence, and the stall fee is assessed and paid at the Treasurer.'
 WHERE name = 'Market Stall/Vending Permit';

UPDATE permit_types SET description =
 'The Motorized Tricycle Operator''s Permit — the city''s authority to operate a tricycle for hire on a given route. Your driver''s licence and the vehicle''s OR/CR are checked by the LTO; the franchise itself is the city''s to grant.'
 WHERE name = 'MTOP/TODA Permit';

UPDATE permit_types SET description =
 'Required before installing signage, billboards or any outdoor advertising. Checks placement against zoning rules, and anything structural is reviewed by the Building Official.'
 WHERE name = 'Sign Permit';

UPDATE permit_types SET description =
 'For concerts, fiestas, fun runs, bazaars and other gatherings. Covers police coordination and crowd safety; add the liquor question if drink will be served.'
 WHERE name = 'Special Event';

-- ---------------------------------------------------------------------------
-- Personal documents — all issued by your barangay, usually same day
-- ---------------------------------------------------------------------------
UPDATE permit_types SET description =
 'General-purpose clearance from your barangay certifying you are a resident in good standing. Commonly asked for by employers, banks and other agencies.'
 WHERE name = 'Barangay Clearance (Personal)';

UPDATE permit_types SET description =
 'A clearance specifically for job applications, stating you live in the barangay and have no pending complaints. Often requested alongside an NBI or police clearance.'
 WHERE name = 'Barangay Employment Clearance';

UPDATE permit_types SET description =
 'Certifies that the barangay has no record of wrongdoing against you. Usually required for school admission, licensure exams or employment.'
 WHERE name = 'Certificate of Good Moral Character';

UPDATE permit_types SET description =
 'Certifies that you cannot afford a fee or service. Used for free medical assistance, legal aid, scholarships and discounted hospital bills.'
 WHERE name = 'Certificate of Indigency';

UPDATE permit_types SET description =
 'Certifies how long you have lived at your address in this barangay. Required for voter registration, school enrolment and many government transactions.'
 WHERE name = 'Certificate of Residency';

UPDATE permit_types SET description =
 'Issued when a dispute brought before the barangay could not be settled, and it releases the case to go to court. Your Lupon mediation records are part of the application.'
 WHERE name = 'Certificate to File Action';

UPDATE permit_types SET description =
 'For first-time jobseekers under the First Time Jobseekers Assistance Act, which waives the fees on documents you need for your first job. Issued once.'
 WHERE name = 'First-Time Jobseeker Certificate';

-- ---------------------------------------------------------------------------
-- Barangay clearances on their own — one stop, and usually a prerequisite for
-- the city permit of the same name
-- ---------------------------------------------------------------------------
UPDATE permit_types SET description =
 'The barangay''s clearance for a new business at an address in its area. A prerequisite for the city Business License — file this first if you do not have one yet.'
 WHERE name = 'Barangay Business Clearance (New)';

UPDATE permit_types SET description =
 'The yearly barangay clearance for a business already operating in its area. Renew this before your Business Permit Renewal; the city asks for it.'
 WHERE name = 'Barangay Business Clearance (Renewal)';

UPDATE permit_types SET description =
 'The barangay''s consent to hold an event in its area. Needed before the city Special Event permit, and on its own for anything small enough to stay within the barangay.'
 WHERE name = 'Barangay Clearance for Special Events';

UPDATE permit_types SET description =
 'The barangay''s endorsement for operating a tricycle on its roads. A prerequisite for the city MTOP/TODA permit.'
 WHERE name = 'Barangay Clearance for Tricycles (TODA)';

UPDATE permit_types SET description =
 'The barangay''s consent to build at an address in its area. A prerequisite for the city Building Permit — file this first if you do not have one yet.'
 WHERE name = 'Barangay Construction Clearance';

UPDATE permit_types SET description =
 'The barangay''s consent to demolish a structure in its area. A prerequisite for the city Demolition Permit.'
 WHERE name = 'Barangay Demolition Clearance';

UPDATE permit_types SET description =
 'The barangay''s consent to dig in or cut into a road in its area. A prerequisite for the city Excavation/Road-Cut Permit.'
 WHERE name = 'Barangay Excavation/Road-Cut Clearance';

UPDATE permit_types SET description =
 'The barangay''s consent to fence a lot in its area. A prerequisite for the city Fencing Permit.'
 WHERE name = 'Barangay Fencing Clearance';
