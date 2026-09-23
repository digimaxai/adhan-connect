-- Async listener ↔ mosque messaging.
-- One thread per listener-mosque pair. Rate limiting (5/listener/mosque/24h) is enforced
-- server-side in the send API route. Inserts always come through service role (no INSERT policy).

CREATE TABLE IF NOT EXISTS public.mosque_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id       uuid        NOT NULL REFERENCES public.mosques(id)    ON DELETE CASCADE,
  listener_id     uuid        NOT NULL REFERENCES auth.users(id)         ON DELETE CASCADE,
  sender_id       uuid        NOT NULL REFERENCES auth.users(id)         ON DELETE CASCADE,
  sender_type     text        NOT NULL CHECK (sender_type IN ('listener', 'admin')),
  body            text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  read_by_admin   boolean     NOT NULL DEFAULT false,
  read_by_listener boolean    NOT NULL DEFAULT false,
  deleted_by_listener boolean NOT NULL DEFAULT false,
  archived_by_admin   boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mosque_messages_thread_idx
  ON public.mosque_messages(mosque_id, listener_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mosque_messages_mosque_idx
  ON public.mosque_messages(mosque_id, created_at DESC);

ALTER TABLE public.mosque_messages ENABLE ROW LEVEL SECURITY;

-- Listeners read their own non-deleted messages
CREATE POLICY "listener_select_own_messages" ON public.mosque_messages
  FOR SELECT TO authenticated
  USING (listener_id = auth.uid() AND deleted_by_listener = false);

-- Listeners can mark messages read or soft-delete their thread
CREATE POLICY "listener_update_own_messages" ON public.mosque_messages
  FOR UPDATE TO authenticated
  USING  (listener_id = auth.uid())
  WITH CHECK (listener_id = auth.uid());

-- Mosque admins read all messages for their mosque
CREATE POLICY "admin_select_mosque_messages" ON public.mosque_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mosque_admins ma
      WHERE ma.mosque_id = mosque_messages.mosque_id
        AND ma.user_id   = auth.uid()
    )
  );

-- Mosque admins can mark read or archive messages for their mosque
CREATE POLICY "admin_update_mosque_messages" ON public.mosque_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mosque_admins ma
      WHERE ma.mosque_id = mosque_messages.mosque_id
        AND ma.user_id   = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mosque_admins ma
      WHERE ma.mosque_id = mosque_messages.mosque_id
        AND ma.user_id   = auth.uid()
    )
  );
