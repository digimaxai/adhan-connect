-- Message content and participant identity are immutable to client roles.
DROP POLICY IF EXISTS listener_update_own_messages ON public.mosque_messages;
DROP POLICY IF EXISTS admin_update_mosque_messages ON public.mosque_messages;
REVOKE ALL ON public.mosque_messages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mosque_messages TO authenticated;
GRANT ALL ON public.mosque_messages TO service_role;

-- Only the authenticated server route may supply the verified sender identity.
CREATE OR REPLACE FUNCTION public.send_mosque_message(
  p_mosque_id uuid, p_listener_id uuid, p_sender_id uuid, p_sender_type text, p_body text
) RETURNS public.mosque_messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result public.mosque_messages;
BEGIN
  IF p_sender_id IS NULL OR p_listener_id IS NULL OR p_mosque_id IS NULL
     OR p_sender_type IS NULL OR p_sender_type NOT IN ('listener', 'admin')
     OR p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Invalid message' USING ERRCODE = '22023';
  END IF;
  IF p_sender_type = 'listener' AND p_sender_id <> p_listener_id THEN
    RAISE EXCEPTION 'Invalid listener' USING ERRCODE = '42501';
  END IF;
  IF p_sender_type = 'admin' AND NOT EXISTS (
    SELECT 1 FROM public.mosque_admins WHERE mosque_id = p_mosque_id AND user_id = p_sender_id
  ) THEN
    RAISE EXCEPTION 'Not a mosque admin' USING ERRCODE = '42501';
  END IF;
  -- Serialize count + insert for this pair, including simultaneous API requests.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_mosque_id::text || ':' || p_listener_id::text, 0));
  IF p_sender_type = 'listener' AND (
    SELECT count(*) FROM public.mosque_messages
    WHERE mosque_id = p_mosque_id AND listener_id = p_listener_id
      AND sender_type = 'listener' AND created_at >= clock_timestamp() - interval '24 hours'
  ) >= 5 THEN
    RAISE EXCEPTION 'Daily message limit reached' USING ERRCODE = 'P0429';
  END IF;
  IF p_sender_type = 'admin' AND NOT EXISTS (
    SELECT 1 FROM public.mosque_messages
    WHERE mosque_id = p_mosque_id AND listener_id = p_listener_id AND sender_type = 'listener'
  ) THEN
    RAISE EXCEPTION 'Listener thread not found' USING ERRCODE = 'P0404';
  END IF;
  INSERT INTO public.mosque_messages(mosque_id, listener_id, sender_id, sender_type, body, read_by_admin, read_by_listener)
  VALUES (p_mosque_id, p_listener_id, p_sender_id, p_sender_type, btrim(p_body), p_sender_type = 'admin', p_sender_type = 'listener')
  RETURNING * INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.send_mosque_message(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_mosque_message(uuid, uuid, uuid, text, text) TO service_role;

-- Explicit operations replace unrestricted row updates; listener identity is always auth.uid().
CREATE OR REPLACE FUNCTION public.update_mosque_message_thread(
  p_mosque_id uuid, p_action text, p_listener_id uuid DEFAULT NULL, p_message_ids uuid[] DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := auth.uid(); target_listener uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501'; END IF;
  IF p_action IN ('listener_read', 'listener_delete') THEN
    target_listener := actor;
  ELSIF p_action IN ('admin_read', 'admin_archive') THEN
    IF p_listener_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.mosque_admins WHERE mosque_id = p_mosque_id AND user_id = actor
    ) THEN RAISE EXCEPTION 'Not a mosque admin' USING ERRCODE = '42501'; END IF;
    target_listener := p_listener_id;
  ELSE
    RAISE EXCEPTION 'Invalid action' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_mosque_id::text || ':' || target_listener::text, 0));
  IF p_action = 'listener_read' THEN
    UPDATE public.mosque_messages SET read_by_listener = true
    WHERE mosque_id = p_mosque_id AND listener_id = actor AND NOT deleted_by_listener
      AND sender_type = 'admin' AND id = ANY(p_message_ids);
  ELSIF p_action = 'listener_delete' THEN
    UPDATE public.mosque_messages SET deleted_by_listener = true WHERE mosque_id = p_mosque_id AND listener_id = actor;
  ELSIF p_action = 'admin_read' THEN
    UPDATE public.mosque_messages SET read_by_admin = true
    WHERE mosque_id = p_mosque_id AND listener_id = target_listener AND sender_type = 'listener' AND id = ANY(p_message_ids);
  ELSE
    UPDATE public.mosque_messages SET archived_by_admin = true WHERE mosque_id = p_mosque_id AND listener_id = target_listener;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.update_mosque_message_thread(uuid, text, uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_mosque_message_thread(uuid, text, uuid, uuid[]) TO authenticated;

-- Aggregate before pagination so the Data API row cap cannot omit older threads or unread messages.
CREATE OR REPLACE FUNCTION public.mosque_message_conversations(p_mosque_id uuid)
RETURNS TABLE(listener_id uuid, mosque_id uuid, last_body text, last_at timestamptz, unread_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.mosque_admins ma WHERE ma.mosque_id = p_mosque_id AND ma.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Not a mosque admin' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT DISTINCT ON (m.listener_id) m.listener_id, m.mosque_id, m.body, m.created_at,
    count(*) FILTER (WHERE m.sender_type = 'listener' AND NOT m.read_by_admin) OVER (PARTITION BY m.listener_id)
  FROM public.mosque_messages m
  WHERE m.mosque_id = p_mosque_id AND NOT m.archived_by_admin
  ORDER BY m.listener_id, m.created_at DESC, m.id DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.mosque_message_conversations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mosque_message_conversations(uuid) TO authenticated;
