-- ---------------------------------------------------------------------------
-- 047 -- PayMongo real-API columns on the payments table
--
-- When the app has a PayMongo secret key configured it creates a real
-- PaymentIntent via the PayMongo API instead of running a local simulation.
-- Two new columns record the state of that real PI:
--
--   paymongo_payment_intent_id  VARCHAR(64) NULL
--       The PI id returned by POST /v1/payment_intents.  Used to retrieve
--       the PI on the return URL callback and on the webhook.
--
--   paymongo_checkout_url  TEXT NULL
--       The next_action.redirect.url from the attached payment method.
--       The applicant is redirected here for 3DS / OTP authorisation.
--
-- method is also made nullable for the brief window between PI creation and
-- the applicant choosing a method on the PayMongo-hosted page (GCash / Maya
-- etc. are chosen inside the PayMongo flow, not before it in our UI, when
-- using the real API).
-- ---------------------------------------------------------------------------

SET @c1 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments'
               AND COLUMN_NAME = 'paymongo_payment_intent_id');
SET @s1 := IF(@c1 = 0,
  'ALTER TABLE payments ADD COLUMN paymongo_payment_intent_id VARCHAR(64) NULL AFTER batch_token',
  'DO 0');
PREPARE s1 FROM @s1; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @c2 := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payments'
               AND COLUMN_NAME = 'paymongo_checkout_url');
SET @s2 := IF(@c2 = 0,
  'ALTER TABLE payments ADD COLUMN paymongo_checkout_url TEXT NULL AFTER paymongo_payment_intent_id',
  'DO 0');
PREPARE s2 FROM @s2; EXECUTE s2; DEALLOCATE PREPARE s2;

-- Allow NULL method: with the real PayMongo flow the method is known only after
-- the applicant completes the PayMongo-hosted checkout, not when we create the PI.
ALTER TABLE payments MODIFY COLUMN method ENUM('gcash','maya','bank_transfer') NULL DEFAULT NULL;

