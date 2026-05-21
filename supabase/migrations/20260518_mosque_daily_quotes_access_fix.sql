-- Repair access for environments that already applied the initial quotes migration.

ALTER TABLE public.mosque_daily_quotes ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.mosque_daily_quotes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mosque_daily_quotes TO authenticated;

DROP POLICY IF EXISTS "Public read mosque daily quotes" ON public.mosque_daily_quotes;
CREATE POLICY "Public read mosque daily quotes"
  ON public.mosque_daily_quotes
  FOR SELECT
  TO public
  USING (true);

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
