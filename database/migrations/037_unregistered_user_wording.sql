-- ---------------------------------------------------------------------------
-- 037 — "Normal User" is now "Unregistered User"
--
-- The account level that can browse permits but not file them is called Unregistered User
-- everywhere the app names it (the Demo account picker already did). The chatbot's help answers
-- still said "Normal User", so this renames it in the FAQ: the question, its Tagalog twin, both
-- answers and the keywords. "normal user" stays in the keywords next to the new name, so someone
-- who still types the old one is answered.
--
-- 005 seeds the FAQ with INSERT IGNORE, which is idempotent only because `question` is unique.
-- Renaming the question frees its old text, so a full re-run of the migration set would insert the
-- old entry again as a new row (005 runs before this file). The DELETE below clears that copy
-- first — and has to, or the rename would try to give two rows the same question and fail.
-- Re-running this file changes nothing.
-- ---------------------------------------------------------------------------

DELETE f FROM faq_entries f
  JOIN faq_entries g ON g.id <> f.id AND g.question = 'What can I do as an Unregistered User?'
 WHERE f.question = 'What can I do as a Normal User?';

-- "a Normal User" first, so the article follows the new name: "as an Unregistered User"
UPDATE faq_entries
   SET question    = REPLACE(REPLACE(question, 'a Normal User', 'an Unregistered User'), 'Normal User', 'Unregistered User'),
       question_tl = REPLACE(question_tl, 'Normal User', 'Unregistered User'),
       answer      = REPLACE(REPLACE(answer, 'a Normal User', 'an Unregistered User'), 'Normal User', 'Unregistered User'),
       answer_tl   = REPLACE(answer_tl, 'Normal User', 'Unregistered User'),
       keywords    = IF(keywords NOT LIKE '%unregistered user%',
                        REPLACE(keywords, 'normal user', 'unregistered user,normal user'), keywords)
 WHERE question LIKE '%Normal User%' OR question_tl LIKE '%Normal User%'
    OR answer LIKE '%Normal User%' OR answer_tl LIKE '%Normal User%'
    OR keywords LIKE '%normal user%';
