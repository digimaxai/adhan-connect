-- Listener-submitted requests to invite a known mosque or ask the Adhan Connect
-- team to add a new one. Fully isolated from public.mosques by design -- no FK,
-- no trigger, no auto-promotion. A human main admin manually creates the real
-- mosques row after reviewing a request here.

CREATE TABLE IF NOT EXISTS public.mosque_add_requests (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type      text        NOT NULL CHECK (request_type IN ('invite_known_mosque', 'request_new_mosque')),
  status            text        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'added', 'declined')),
  mosque_name       text        NOT NULL CHECK (char_length(trim(mosque_name)) >= 2),
  area_description  text,
  contact_name      text,
  contact_email     text,
  contact_phone     text,
  contact_website   text,
  note              text,
  submitted_by      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at       timestamptz,
  admin_notes       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mosque_add_requests_status_created
  ON public.mosque_add_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mosque_add_requests_submitted_by
  ON public.mosque_add_requests (submitted_by);

ALTER TABLE public.mosque_add_requests ENABLE ROW LEVEL SECURITY;

-- Deliberately NOT granted to anon -- guests must sign in before submitting,
-- matching this app's read-only-guest-browsing design.
GRANT SELECT, INSERT, UPDATE ON public.mosque_add_requests TO authenticated;

-- Any signed-in user can submit a request for themselves only.
DROP POLICY IF EXISTS "own_insert_mosque_add_requests" ON public.mosque_add_requests;
CREATE POLICY "own_insert_mosque_add_requests"
  ON public.mosque_add_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- No self-select policy: submitters get a local success confirmation on
-- insert, not a read-back. Only main admins can list/read requests.
DROP POLICY IF EXISTS "main_admin_select_mosque_add_requests" ON public.mosque_add_requests;
CREATE POLICY "main_admin_select_mosque_add_requests"
  ON public.mosque_add_requests
  FOR SELECT
  TO authenticated
  USING (public.is_main_admin());

DROP POLICY IF EXISTS "main_admin_update_mosque_add_requests" ON public.mosque_add_requests;
CREATE POLICY "main_admin_update_mosque_add_requests"
  ON public.mosque_add_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_main_admin())
  WITH CHECK (public.is_main_admin());

-- Self-contained updated_at trigger (deliberately not reusing
-- public.set_updated_at(), which has no creating migration in this repo --
-- see mosque_daily_quotes for the precedent of a bespoke trigger instead).
CREATE OR REPLACE FUNCTION public.update_mosque_add_requests_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mosque_add_requests_updated_at ON public.mosque_add_requests;
CREATE TRIGGER mosque_add_requests_updated_at
  BEFORE UPDATE ON public.mosque_add_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_mosque_add_requests_updated_at();

COMMENT ON TABLE public.mosque_add_requests IS
  'Listener-submitted requests to invite a known mosque or ask the Adhan Connect team to add a new one. Fully isolated from public.mosques by design -- no FK, no trigger, no auto-promotion. A human admin manually creates the real mosques row after review.';
