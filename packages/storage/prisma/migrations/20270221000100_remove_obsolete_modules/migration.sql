-- Remove obsolete modules: onboarding invites, sales entities, agreements module.
-- These tables may or may not exist depending on which migrations were applied.

DROP TABLE IF EXISTS "onboarding_invites" CASCADE;

DROP TABLE IF EXISTS "sales_deals" CASCADE;
DROP TABLE IF EXISTS "sales_proposals" CASCADE;
DROP TABLE IF EXISTS "sales_simulations" CASCADE;

DROP TABLE IF EXISTS "agreement_import_jobs" CASCADE;
DROP TABLE IF EXISTS "agreement_history" CASCADE;
DROP TABLE IF EXISTS "agreement_rates" CASCADE;
DROP TABLE IF EXISTS "agreement_windows" CASCADE;
DROP TABLE IF EXISTS "agreement_tables" CASCADE;
DROP TABLE IF EXISTS "agreements" CASCADE;

