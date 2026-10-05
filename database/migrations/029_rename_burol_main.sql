-- ---------------------------------------------------------------------------
-- 029 — Barangay "Burol" is "Burol Main"
--
-- The barangay list was seeded with "Burol" beside "Burol I", "Burol II" and "Burol III". It is
-- renamed to "Burol Main" to say which of the four it is, with its secretariat and secretary
-- following the name.
--
-- Matching is on the exact name "Burol", so "Burol I", "Burol II" and "Burol III" are untouched.
-- Account emails are not changed: they are the sign-in identifier, and changing them would lock out
-- the secretary. Re-running this file changes nothing, because "Burol" no longer exists.
-- ---------------------------------------------------------------------------

-- Free-text barangay copies on records, so they keep matching the list.
UPDATE users                SET barangay = 'Burol Main' WHERE barangay = 'Burol';
UPDATE resident_verifications SET barangay = 'Burol Main' WHERE barangay = 'Burol';
UPDATE businesses           SET barangay = 'Burol Main' WHERE barangay = 'Burol';

-- The barangay itself.
UPDATE barangays SET name = 'Burol Main' WHERE name = 'Burol';

-- Its secretariat and secretary, found through the barangay they belong to.
UPDATE departments
   SET name = 'Barangay Burol Main Secretariat'
 WHERE barangay_id = (SELECT id FROM barangays WHERE name = 'Burol Main')
   AND name = 'Barangay Burol Secretariat';

UPDATE users u
  JOIN departments d ON d.id = u.department_id
   SET u.full_name = CONCAT('Barangay Secretary — ', 'Burol Main')
 WHERE d.barangay_id = (SELECT id FROM barangays WHERE name = 'Burol Main')
   AND u.full_name = CONCAT('Barangay Secretary — ', 'Burol');
