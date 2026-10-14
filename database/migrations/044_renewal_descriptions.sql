-- ---------------------------------------------------------------------------
-- 044 -- Descriptions for the six renewal permit types added in 039
--
-- Idempotent: safe to run multiple times (plain idempotent assignments).
-- ---------------------------------------------------------------------------

UPDATE permit_types SET description = 'The yearly renewal of your sanitary permit and food establishment clearance. Re-checks staff health cards, water potability test results, and fire safety inspection.'
 WHERE name = 'Food Service (Sanitary) Renewal';

UPDATE permit_types SET description = 'The yearly renewal of your liquor and tobacco retailing authority, re-validating police clearance and premises compliance alongside your business permit.'
 WHERE name = 'Liquor/Tobacco License Renewal';

UPDATE permit_types SET description = 'The yearly renewal of your public market stall lease or ambulant vending authority, with fees re-assessed and cleared through the City Treasurer.'
 WHERE name = 'Market Stall/Vending Permit Renewal';

UPDATE permit_types SET description = 'The yearly renewal of your Motorized Tricycle Operator''s Permit (MTOP) franchise, verifying continued route compliance, driver licensing, and vehicle registration.'
 WHERE name = 'MTOP/TODA Permit Renewal';

UPDATE permit_types SET description = 'The yearly renewal of your outdoor advertising, signboard or billboard permit, verifying structural safety and zoning compliance for existing signage.'
 WHERE name = 'Sign Permit Renewal';

UPDATE permit_types SET description = 'The yearly barangay endorsement for continuing tricycle operations within the barangay. Required before renewing your city MTOP/TODA franchise.'
 WHERE name = 'Barangay Clearance for Tricycles (TODA) Renewal';
