-- Run inside a transaction and roll it back. Uses existing identities; never sends email.
DO $$
DECLARE mosque uuid; admin_id uuid; listener uuid; outsider uuid; msg public.mosque_messages; reply public.mosque_messages; n bigint;
BEGIN
  SELECT ma.mosque_id, ma.user_id INTO mosque, admin_id FROM public.mosque_admins ma LIMIT 1;
  SELECT id INTO listener FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.mosque_admins ma WHERE ma.user_id=u.id) LIMIT 1;
  SELECT id INTO outsider FROM auth.users u WHERE u.id <> listener AND NOT EXISTS (SELECT 1 FROM public.mosque_admins ma WHERE ma.user_id=u.id) LIMIT 1;
  ASSERT mosque IS NOT NULL AND listener IS NOT NULL AND outsider IS NOT NULL, 'Test identities required';
  ASSERT NOT has_table_privilege('authenticated', 'public.mosque_messages', 'UPDATE'), 'Client UPDATE must be denied';
  ASSERT NOT has_table_privilege('authenticated', 'public.mosque_messages', 'INSERT'), 'Client INSERT must be denied';
  ASSERT NOT has_table_privilege('authenticated', 'public.mosque_messages', 'DELETE'), 'Client DELETE must be denied';
  ASSERT NOT has_function_privilege('authenticated', 'public.send_mosque_message(uuid,uuid,uuid,text,text)', 'EXECUTE'), 'Client send RPC must be denied';
  ASSERT NOT has_function_privilege('anon', 'public.update_mosque_message_thread(uuid,text,uuid,uuid[])', 'EXECUTE'), 'Guest mutations must be denied';
  -- Scope test fixtures to this rollback-only transaction, avoiding any existing thread rate count.
  DELETE FROM public.mosque_messages WHERE mosque_id=mosque AND listener_id IN (listener, outsider, admin_id);
  msg := public.send_mosque_message(mosque, listener, listener, 'listener', 'Review fixture');
  PERFORM public.send_mosque_message(mosque, outsider, outsider, 'listener', 'Other fixture');
  PERFORM public.send_mosque_message(mosque, admin_id, admin_id, 'listener', 'Dual role fixture');
  FOR i IN 1..4 LOOP PERFORM public.send_mosque_message(mosque, listener, listener, 'listener', 'Rate fixture'); END LOOP;
  BEGIN
    PERFORM public.send_mosque_message(mosque, listener, listener, 'listener', 'Must fail');
    RAISE EXCEPTION 'Sixth message accepted';
  EXCEPTION WHEN SQLSTATE 'P0429' THEN NULL; END;
  BEGIN
    PERFORM public.send_mosque_message(mosque, listener, outsider, 'admin', 'Must fail');
    RAISE EXCEPTION 'Unauthorized reply accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.send_mosque_message(mosque, listener, outsider, 'listener', 'Must fail');
    RAISE EXCEPTION 'Forged listener accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  reply := public.send_mosque_message(mosque, listener, admin_id, 'admin', 'Reply fixture');
  PERFORM set_config('request.jwt.claim.sub', listener::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.mosque_add_requests(request_type, mosque_name, submitted_by, submitter_role_at_mosque)
  VALUES ('mosque_admin_self', 'Review fixture mosque', listener, 'Trustee');
  BEGIN
    INSERT INTO public.mosque_add_requests(request_type, mosque_name, submitted_by)
    VALUES ('mosque_admin_self', 'Forged request', outsider);
    RAISE EXCEPTION 'Request submitter spoofing accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  SELECT count(*) INTO n FROM public.mosque_messages WHERE mosque_id=mosque;
  ASSERT n=6, 'Listener RLS leaked another thread';
  BEGIN
    UPDATE public.mosque_messages SET body='tampered' WHERE id=msg.id;
    RAISE EXCEPTION 'Client altered message body';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.update_mosque_message_thread(mosque, 'admin_archive', outsider);
    RAISE EXCEPTION 'Listener archived another thread';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.mosque_message_conversations(mosque);
    RAISE EXCEPTION 'Listener read admin inbox';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.update_mosque_message_thread(mosque, 'listener_read', outsider, ARRAY[reply.id]);
  ASSERT (SELECT read_by_listener FROM public.mosque_messages WHERE id=reply.id), 'Read failed';
  PERFORM public.update_mosque_message_thread(mosque, 'listener_delete', outsider);
  SELECT count(*) INTO n FROM public.mosque_messages WHERE mosque_id=mosque;
  ASSERT n=0, 'Listener delete failed';
  RESET ROLE;
  ASSERT (SELECT count(*) FROM public.mosque_messages WHERE mosque_id=mosque AND listener_id=outsider AND NOT deleted_by_listener)=1, 'Delete affected other listener';
  BEGIN
    PERFORM public.send_mosque_message(mosque, listener, listener, 'listener', 'Delete must not reset limit');
    RAISE EXCEPTION 'Delete bypassed rate limit';
  EXCEPTION WHEN SQLSTATE 'P0429' THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub', admin_id::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.mosque_messages WHERE mosque_id=mosque;
  ASSERT n=8, 'Admin cannot read deleted listener messages';
  PERFORM public.update_mosque_message_thread(mosque, 'listener_delete', outsider);
  PERFORM public.update_mosque_message_thread(mosque, 'admin_read', listener, ARRAY[msg.id]);
  ASSERT (SELECT unread_count FROM public.mosque_message_conversations(mosque) WHERE listener_id=listener)=4, 'Read marked unseen messages';
  PERFORM public.update_mosque_message_thread(mosque, 'admin_archive', listener);
  ASSERT NOT EXISTS (SELECT 1 FROM public.mosque_message_conversations(mosque) WHERE listener_id=listener), 'Archive failed';
  RESET ROLE;
  ASSERT NOT (SELECT deleted_by_listener FROM public.mosque_messages WHERE listener_id=outsider AND mosque_id=mosque LIMIT 1), 'Dual role listener delete affected other thread';
  UPDATE public.mosque_messages SET created_at=now()-interval '25 hours' WHERE listener_id=listener AND mosque_id=mosque;
  PERFORM public.send_mosque_message(mosque, listener, listener, 'listener', 'New message reopens archived thread');
  PERFORM set_config('request.jwt.claim.sub', admin_id::text, true);
  SET LOCAL ROLE authenticated;
  ASSERT (SELECT unread_count FROM public.mosque_message_conversations(mosque) WHERE listener_id=listener)=1, 'New message did not reopen thread';
  RESET ROLE;
END;
$$;
SELECT 'Messaging permission, rate limit, read, archive, delete and dual-role tests passed' AS result;
