-- ---------------------------------------------------------------------------
-- 026 — Addresses carry their PSGC codes
--
-- `city` was free text, which is how "Dasmariñas", "dasmarinas, Cavite" and
-- "Dasmari±as" all ended up meaning the same place. Whether an account is in
-- this city decides whether it can hold residency and file resident permits, so
-- it should not rest on spelling.
--
-- The province and city now also store their PSGC codes, and "is this our city"
-- is a code comparison against 042106000 (City of Dasmariñas, Cavite). The names
-- stay alongside for display and for anything already reading them.
--
-- Barangay is unchanged: inside Dasmariñas it stays a real foreign key into
-- `barangays`, which is what routes a permit to a secretariat. Outside the city
-- there is no barangay office to route to, so it is left null.
--
-- Idempotent: columns are added only if absent, and the backfill only fills
-- rows that are still null.
-- ---------------------------------------------------------------------------

SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'province_code');
SET @s1 := IF(@c1 = 0, 'ALTER TABLE users ADD COLUMN province_code VARCHAR(12) NULL AFTER city', 'DO 0');
PREPARE s1 FROM @s1; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @c2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'province');
SET @s2 := IF(@c2 = 0, 'ALTER TABLE users ADD COLUMN province VARCHAR(100) NULL AFTER province_code', 'DO 0');
PREPARE s2 FROM @s2; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @c3 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'city_code');
SET @s3 := IF(@c3 = 0, 'ALTER TABLE users ADD COLUMN city_code VARCHAR(12) NULL AFTER city', 'DO 0');
PREPARE s3 FROM @s3; EXECUTE s3; DEALLOCATE PREPARE s3;

-- Anyone already recorded as being in this city, however it was spelt, gets the
-- real codes. A barangay_id is proof of it: those only exist for Dasmariñas.
UPDATE users
   SET city_code = '042106000',
       city = 'City of Dasmariñas',
       province_code = '042100000',
       province = 'Cavite'
 WHERE city_code IS NULL
   AND (barangay_id IS NOT NULL
        OR city COLLATE utf8mb4_general_ci LIKE '%dasmari%');

-- Everyone else keeps the city they typed; the codes stay null until they next
-- edit their address, where the picker will set them.
