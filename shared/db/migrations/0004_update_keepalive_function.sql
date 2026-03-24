-- Update keepalive function to read from a real table.
-- SELECT true touches no tables, so Supabase's inactivity monitor (pg_stat_user_tables)
-- sees no activity and pauses the project despite the API call succeeding.
-- Reading from core.embeddings ensures table-level activity is registered.

CREATE OR REPLACE FUNCTION public.keepalive()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT true FROM core.embeddings LIMIT 1),
    true
  );
$$;
