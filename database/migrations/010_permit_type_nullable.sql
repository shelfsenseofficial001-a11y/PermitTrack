-- 010: applications.permit_type (legacy 5-value ENUM, NOT NULL) can't hold any of the
-- 22 new permit type names added in 008 — inserting one under strict SQL mode fails
-- outright. New-pipeline submissions store the real type in permit_type_id and its
-- readable name comes from permit_types.name via join; the legacy column is now
-- nullable so those inserts don't have to fake a value. See BREAKING_CHANGES.md.
--
-- Safe to run more than once. Apply with:
--   mysql -u root permittrack < database/migrations/010_permit_type_nullable.sql

USE permittrack;

ALTER TABLE applications
    MODIFY permit_type ENUM('Food Service','Building/Renovation','Sign','Business License','Special Event') NULL;
