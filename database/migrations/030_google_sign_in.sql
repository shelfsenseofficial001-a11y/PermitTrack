-- ---------------------------------------------------------------------------
-- 030 — Sign in with Google
--
-- An account can be linked to a Google account. The link is Google's `sub` — the
-- stable account id from the ID token — not the email address, which a person can
-- change at Google. An existing account is linked the first time its owner signs in
-- with Google under the same verified email; a new one is created with the link.
--
-- Accounts created through Google have no password: password_hash is the empty
-- string, which password_verify() never matches. Their owner can set one later
-- from Change password, which skips the "current password" step for them.
--
-- Idempotent: the column and its index are added only if absent.
-- ---------------------------------------------------------------------------

SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'google_sub');
SET @s1 := IF(@c1 = 0, 'ALTER TABLE users ADD COLUMN google_sub VARCHAR(64) NULL AFTER password_hash', 'DO 0');
PREPARE s1 FROM @s1; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @c2 := (SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uq_users_google_sub');
SET @s2 := IF(@c2 = 0, 'ALTER TABLE users ADD UNIQUE KEY uq_users_google_sub (google_sub)', 'DO 0');
PREPARE s2 FROM @s2; EXECUTE s2; DEALLOCATE PREPARE s2;
