-- Daily spiritual quotes set by local/main admins per mosque.
-- Displayed on the listener home screen as "Today's Reflection".

CREATE TABLE IF NOT EXISTS public.mosque_daily_quotes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id   uuid        NOT NULL REFERENCES public.mosques(id) ON DELETE CASCADE,
  quote_date  date        NOT NULL,
  text_en     text        NOT NULL CHECK (char_length(trim(text_en)) >= 5),
  text_ar     text,
  source      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mosque_id, quote_date)
);

ALTER TABLE public.mosque_daily_quotes ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.mosque_daily_quotes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mosque_daily_quotes TO authenticated;

-- Listeners (public) can read any mosque's quote
DROP POLICY IF EXISTS "Public read mosque daily quotes" ON public.mosque_daily_quotes;
CREATE POLICY "Public read mosque daily quotes"
  ON public.mosque_daily_quotes
  FOR SELECT
  TO public
  USING (true);

-- Local admins manage quotes for their mosque
DROP POLICY IF EXISTS "Local admins manage mosque daily quotes" ON public.mosque_daily_quotes;

DROP POLICY IF EXISTS "Local admins insert mosque daily quotes" ON public.mosque_daily_quotes;
CREATE POLICY "Local admins insert mosque daily quotes"
  ON public.mosque_daily_quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_main_admin() OR public.is_local_admin_for_mosque(mosque_id));

DROP POLICY IF EXISTS "Local admins update mosque daily quotes" ON public.mosque_daily_quotes;
CREATE POLICY "Local admins update mosque daily quotes"
  ON public.mosque_daily_quotes
  FOR UPDATE
  TO authenticated
  USING (public.is_main_admin() OR public.is_local_admin_for_mosque(mosque_id))
  WITH CHECK (public.is_main_admin() OR public.is_local_admin_for_mosque(mosque_id));

DROP POLICY IF EXISTS "Local admins delete mosque daily quotes" ON public.mosque_daily_quotes;
CREATE POLICY "Local admins delete mosque daily quotes"
  ON public.mosque_daily_quotes
  FOR DELETE
  TO authenticated
  USING (public.is_main_admin() OR public.is_local_admin_for_mosque(mosque_id));

-- Keep updated_at current on writes
CREATE OR REPLACE FUNCTION public.update_mosque_daily_quotes_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mosque_daily_quotes_updated_at ON public.mosque_daily_quotes;
CREATE TRIGGER mosque_daily_quotes_updated_at
  BEFORE UPDATE ON public.mosque_daily_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_mosque_daily_quotes_updated_at();
