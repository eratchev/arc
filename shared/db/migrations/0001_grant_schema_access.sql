-- Grant schema usage and table privileges to Supabase roles.
-- Without these grants, service_role and authenticated cannot access
-- custom schemas (sds, mos, core), causing silent failures in
-- cross-schema operations like the SDS -> MOS sync.

-- sds schema
GRANT USAGE ON SCHEMA sds TO service_role, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA sds TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sds TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA sds GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA sds GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- mos schema
GRANT USAGE ON SCHEMA mos TO service_role, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA mos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mos TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA mos GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA mos GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- core schema
GRANT USAGE ON SCHEMA core TO service_role, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA core TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
