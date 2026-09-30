-- 017: Corrects 12 rows mangled by a Windows mysql.exe CLI bug that non-deterministically
-- corrupts non-ASCII bytes on file-redirect INSERTs (reproduced with, and without, corruption on
-- separate runs of the exact same file against the exact same content -- it is NOT reliably safe
-- to just retype the correct characters into a .sql file and re-run it). Only the n-with-tilde in
-- "Santo Nino" and "Dasmarinas" is affected -- the only non-ASCII character used anywhere in
-- migrations 001-016 (plus the em dash next to it in a few of those strings).
--
-- This migration sidesteps the bug entirely: every non-ASCII character is built server-side with
-- UNHEX() from its UTF-8 byte sequence (n-with-tilde = C3B1, em dash = E28094) instead of being
-- written as a literal multi-byte character anywhere in this file, including in comments -- the
-- file is pure ASCII end to end, so the CLI has nothing multi-byte to mis-transmit. See
-- BREAKING_CHANGES.md #10.
--
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/017_encoding_fix.sql

USE permittrack;

SET @ntilde = UNHEX('C3B1');   -- n-with-tilde
SET @emdash = UNHEX('E28094'); -- em dash

UPDATE barangays SET name = CONCAT('Santo Ni', @ntilde, 'o I') WHERE name LIKE 'Santo Ni%' AND name LIKE '%I' AND name NOT LIKE '%II';
UPDATE barangays SET name = CONCAT('Santo Ni', @ntilde, 'o II') WHERE name LIKE 'Santo Ni%II';

UPDATE departments SET name = CONCAT('Bureau of Fire Protection ', @emdash, ' Dasmari', @ntilde, 'as Station') WHERE code = 'BFP';
UPDATE departments SET name = CONCAT('Philippine National Police ', @emdash, ' Dasmari', @ntilde, 'as') WHERE code = 'PNP';

UPDATE departments d JOIN barangays b ON b.id = d.barangay_id
    SET d.name = CONCAT('Barangay ', b.name, ' Secretariat'),
        d.description = CONCAT('Barangay-level clearances for ', b.name)
WHERE b.name LIKE CONCAT('Santo Ni', @ntilde, 'o%');

UPDATE faq_entries SET
    answer = CONCAT(
        'Your barangay is selected when you verify your residency (or, for a business, its registered address). It determines which Barangay office reviews the barangay stage of your permits and any barangay-only documents you request ',
        @emdash, ' Dasmari', @ntilde, 'as has 75 barangays, each with its own office.'
    )
WHERE question = 'Why does my barangay matter?';

UPDATE faq_entries SET
    answer_tl = CONCAT(
        'Pinipili ang iyong barangay kapag ni-verify mo ang iyong residency (o, para sa negosyo, ang rehistradong address nito). Ito ang magtatakda kung aling opisina ng Barangay ang susuri sa barangay stage ng iyong mga permit at anumang barangay-only na dokumento na hihilingin mo ',
        @emdash, ' may 75 barangay ang Dasmari', @ntilde, 'as, bawat isa ay may sariling opisina.'
    )
WHERE question = 'Why does my barangay matter?';

UPDATE users u JOIN departments d ON d.id = u.department_id JOIN barangays b ON b.id = d.barangay_id
    SET u.full_name = CONCAT('Barangay Secretary ', @emdash, ' ', b.name)
WHERE b.name LIKE CONCAT('Santo Ni', @ntilde, 'o%') AND u.role = 'staff';
