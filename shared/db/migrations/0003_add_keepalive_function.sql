-- Creates a lightweight public function for the keep-alive GitHub Actions workflow.
-- Called via POST /rest/v1/rpc/keepalive using the anon key, which forces a real
-- database connection and prevents Supabase from pausing the project.

CREATE OR REPLACE FUNCTION public.keepalive()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT true;
$$;

GRANT EXECUTE ON FUNCTION public.keepalive() TO anon;
