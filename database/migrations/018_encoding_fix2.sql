-- 018: Corrects a SECOND, much larger batch of rows mangled by the same mysql.exe CLI bug as 017
-- (see BREAKING_CHANGES.md #10) -- this one turns an em dash / en dash / right arrow into a
-- 3-character Latin-1-Supplement mojibake sequence instead of the CP437 box-drawing bytes 017
-- fixed. 017's detection scan (looking only for CP437 bytes) missed this pattern entirely; a
-- broader rescan afterwards found 99 affected rows: most "Barangay Secretary -- <name>" user
-- rows, 2 department rows, and about 20 FAQ answer/answer_tl rows -- anywhere an em dash, en
-- dash, or right arrow was ever written by a CLI migration (008, 014, 015).
--
-- Same fix strategy as 017: every value is built server-side with UNHEX() from its UTF-8 bytes,
-- so this file is pure ASCII end to end and the CLI has nothing multi-byte to mis-transmit.
--
-- Safe to run more than once (REPLACE() is a no-op once the bad sequence is gone). Apply with:
--   mysql -u root permittrack < database/migrations/018_encoding_fix2.sql

USE permittrack;

-- The three garbage sequences this corruption produces, and what each one should be.
SET @bad_emdash = UNHEX('C394C387C3B6'); -- mojibake for em dash (O-circumflex, C-cedilla, o-umlaut)
SET @ok_emdash  = UNHEX('E28094');       -- em dash, U+2014
SET @bad_arrow  = UNHEX('C394C3A5C386'); -- mojibake for right arrow (O-circumflex, a-ring, AE)
SET @ok_arrow   = UNHEX('E28692');       -- right arrow, U+2192
SET @bad_endash = UNHEX('C394C387C3B4'); -- mojibake for en dash (O-circumflex, C-cedilla, o-circumflex)
SET @ok_endash  = UNHEX('E28093');       -- en dash, U+2013

UPDATE departments SET
    name = REPLACE(REPLACE(REPLACE(name, @bad_emdash, @ok_emdash), @bad_arrow, @ok_arrow), @bad_endash, @ok_endash),
    description = REPLACE(REPLACE(REPLACE(description, @bad_emdash, @ok_emdash), @bad_arrow, @ok_arrow), @bad_endash, @ok_endash)
WHERE name LIKE CONCAT('%', @bad_emdash, '%') OR description LIKE CONCAT('%', @bad_emdash, '%')
   OR name LIKE CONCAT('%', @bad_arrow, '%') OR description LIKE CONCAT('%', @bad_arrow, '%')
   OR name LIKE CONCAT('%', @bad_endash, '%') OR description LIKE CONCAT('%', @bad_endash, '%');

UPDATE users SET
    full_name = REPLACE(REPLACE(REPLACE(full_name, @bad_emdash, @ok_emdash), @bad_arrow, @ok_arrow), @bad_endash, @ok_endash)
WHERE full_name LIKE CONCAT('%', @bad_emdash, '%')
   OR full_name LIKE CONCAT('%', @bad_arrow, '%')
   OR full_name LIKE CONCAT('%', @bad_endash, '%');

UPDATE faq_entries SET
    question = REPLACE(REPLACE(REPLACE(question, @bad_emdash, @ok_emdash), @bad_arrow, @ok_arrow), @bad_endash, @ok_endash),
    question_tl = REPLACE(REPLACE(REPLACE(question_tl, @bad_emdash, @ok_emdash), @bad_arrow, @ok_arrow), @bad_endash, @ok_endash),
    answer = REPLACE(REPLACE(REPLACE(answer, @bad_emdash, @ok_emdash), @bad_arrow, @ok_arrow), @bad_endash, @ok_endash),
    answer_tl = REPLACE(REPLACE(REPLACE(answer_tl, @bad_emdash, @ok_emdash), @bad_arrow, @ok_arrow), @bad_endash, @ok_endash),
    keywords = REPLACE(REPLACE(REPLACE(keywords, @bad_emdash, @ok_emdash), @bad_arrow, @ok_arrow), @bad_endash, @ok_endash)
WHERE question LIKE CONCAT('%', @bad_emdash, '%') OR question_tl LIKE CONCAT('%', @bad_emdash, '%')
   OR answer LIKE CONCAT('%', @bad_emdash, '%') OR answer_tl LIKE CONCAT('%', @bad_emdash, '%') OR keywords LIKE CONCAT('%', @bad_emdash, '%')
   OR question LIKE CONCAT('%', @bad_arrow, '%') OR question_tl LIKE CONCAT('%', @bad_arrow, '%')
   OR answer LIKE CONCAT('%', @bad_arrow, '%') OR answer_tl LIKE CONCAT('%', @bad_arrow, '%') OR keywords LIKE CONCAT('%', @bad_arrow, '%')
   OR question LIKE CONCAT('%', @bad_endash, '%') OR question_tl LIKE CONCAT('%', @bad_endash, '%')
   OR answer LIKE CONCAT('%', @bad_endash, '%') OR answer_tl LIKE CONCAT('%', @bad_endash, '%') OR keywords LIKE CONCAT('%', @bad_endash, '%');
