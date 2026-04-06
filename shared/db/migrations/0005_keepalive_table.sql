-- Replace the read-only keepalive function with one that writes to a dedicated table.
-- Supabase's inactivity monitor reliably counts write operations (UPDATE) whereas
-- SELECT-only queries on non-public schemas may not register as user activity.

CREATE TABLE IF NOT EXISTS public.keepalive (
  id    integer PRIMARY KEY DEFAULT 1,
  last_ping timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT keepalive_single_row CHECK (id = 1)
);

-- Seed the single row.
INSERT INTO public.keepalive (id, last_ping) VALUES (1, now())
  ON CONFLICT (id) DO NOTHING;

-- Allow the anon role to call the RPC and read the table (no sensitive data here).
GRANT SELECT ON public.keepalive TO anon;

CREATE OR REPLACE FUNCTION public.keepalive()
RETURNS timestamptz
LANGUAGE sql
VOLATILE SECURITY DEFINER
AS $$
  UPDATE public.keepalive SET last_ping = now() WHERE id = 1 RETURNING last_ping;
$$;
