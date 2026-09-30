-- 016: Fix a keyword collision found while testing Tagalog matching, and add Tagalog keywords
-- to the FAQ entries added in migration 014 (their keywords were English-only, so a purely
-- Tagalog phrasing of the same question wouldn't score as well as it should).
--
-- The collision: "What documents do I need to register a business?" (sort_order 70) and
-- "What are barangay clearances?" (sort_order 97) both listed "barangay clearance" as a keyword.
-- Asking about barangay clearances scored an exact tie between them, and the stable sort kept
-- whichever was seeded first (order 70) — the wrong, less specific answer won.
--
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/016_chatbot_faq_keyword_fixes.sql

USE permittrack;

UPDATE faq_entries SET
    keywords = 'business documents,business requirements,dti,sec,cda,tin,secretary''s certificate,board resolution,spa,requirements business,dokumento ng negosyo'
WHERE question = 'What documents do I need to register a business?';

UPDATE faq_entries SET
    keywords = CONCAT(keywords, ',paano gumagana ang pagsusuri,proseso ng pagsusuri,mga hakbang,ilang opisina,anong opisina')
WHERE question = 'How does the permit review process work?' AND keywords NOT LIKE '%proseso ng pagsusuri%';

UPDATE faq_entries SET
    keywords = CONCAT(keywords, ',karagdagang tanong,bakit magtatanong,kondisyon,huwag idedeklara')
WHERE question = 'Why do I need to answer extra questions when applying?' AND keywords NOT LIKE '%karagdagang tanong%';

UPDATE faq_entries SET
    keywords = CONCAT(keywords, ',ano ang barangay clearance,dokumento ng barangay,katibayan ng barangay')
WHERE question = 'What are barangay clearances?' AND keywords NOT LIKE '%dokumento ng barangay%';

UPDATE faq_entries SET
    keywords = CONCAT(keywords, ',bakit mahalaga ang barangay,aking barangay,piniling barangay')
WHERE question = 'Why does my barangay matter?' AND keywords NOT LIKE '%aking barangay%';
