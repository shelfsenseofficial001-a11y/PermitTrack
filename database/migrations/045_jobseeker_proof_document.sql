-- ---------------------------------------------------------------------------
-- 045 — First-time job seeker now requires proof (Certificate) when answered Yes
--
-- Migration 038 seeded the 'first_time_jobseeker' quick question for the four
-- eligible permit types (Barangay Clearance (Personal), Barangay Employment
-- Clearance, Certificate of Good Moral Character, Certificate of Residency)
-- but left requires_document NULL — answering Yes triggered the fee waiver but
-- did not add any document to the required list.
--
-- This migration sets requires_document = 'First-Time Jobseeker Certificate'
-- so that answering Yes also adds that document to the upload step, consistent
-- with how the senior_citizen question works (requires 'Senior Citizen ID').
--
-- Idempotent: the WHERE clause skips rows that already carry the value.
-- ---------------------------------------------------------------------------

UPDATE permit_type_conditions
   SET requires_document = 'First-Time Jobseeker Certificate'
 WHERE condition_key = 'first_time_jobseeker'
   AND (requires_document IS NULL OR requires_document <> 'First-Time Jobseeker Certificate');

