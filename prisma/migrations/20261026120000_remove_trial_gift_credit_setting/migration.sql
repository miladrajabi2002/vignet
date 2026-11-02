-- The gift-credit feature is being removed entirely:
-- 1. Trial signup credit is now hardcoded (TRIAL_SIGNUP_CREDIT_IRR in
--    lib/billing/plans.ts) instead of admin-configurable.
-- 2. Paid plans no longer grant a first-purchase included credit
--    (grantIncludedPlanCredit and its admin field were removed).
-- The PlatformAiSettings.trialCreditIRR column is therefore dead.
ALTER TABLE "PlatformAiSettings" DROP COLUMN IF EXISTS "trialCreditIRR";
