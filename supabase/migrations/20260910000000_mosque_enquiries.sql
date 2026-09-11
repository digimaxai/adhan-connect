-- Structured requests are separate from legacy pair-based chat. Existing clients remain supported.
CREATE TABLE public.mosque_enquiry_categories (
 id text PRIMARY KEY, label text NOT NULL, reasons text[] NOT NULL, enabled_by_default boolean NOT NULL
);
CREATE TABLE public.mosque_enquiry_settings (
 mosque_id uuid PRIMARY KEY REFERENCES public.mosques(id) ON DELETE CASCADE,
 enabled_categories text[] NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mosque_enquiries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mosque_id uuid NOT NULL REFERENCES public.mosques(id) ON DELETE CASCADE,
 -- Nullable for a future independently verified contact flow; no guest access is granted now.
 account_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 contact_name text NOT NULL CHECK (char_length(btrim(contact_name)) BETWEEN 2 AND 120),
 contact_email text NOT NULL CHECK (char_length(contact_email) BETWEEN 3 AND 254),
 email_verified boolean NOT NULL DEFAULT false,
 callback_phone text CHECK (callback_phone IS NULL OR char_length(callback_phone) BETWEEN 7 AND 40),
 category text NOT NULL REFERENCES public.mosque_enquiry_categories(id),
 reason text NOT NULL,
 details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 2000),
 status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','waiting_for_listener','resolved')),
 deleted_by_listener boolean NOT NULL DEFAULT false,
 archived_by_admin boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mosque_enquiry_replies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 enquiry_id uuid NOT NULL REFERENCES public.mosque_enquiries(id) ON DELETE CASCADE,
 sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 sender_type text NOT NULL CHECK (sender_type IN ('listener','admin')),
 body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mosque_enquiries(mosque_id, updated_at DESC, id);
CREATE INDEX ON public.mosque_enquiries(account_id, created_at DESC);
CREATE INDEX ON public.mosque_enquiry_replies(enquiry_id, created_at, id);
ALTER TABLE public.mosque_enquiry_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mosque_enquiry_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mosque_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mosque_enquiry_replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mosque_enquiry_categories, public.mosque_enquiry_settings, public.mosque_enquiries, public.mosque_enquiry_replies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mosque_enquiry_categories, public.mosque_enquiry_settings, public.mosque_enquiries, public.mosque_enquiry_replies TO authenticated;
GRANT ALL ON public.mosque_enquiry_categories, public.mosque_enquiry_settings, public.mosque_enquiries, public.mosque_enquiry_replies TO service_role;
CREATE POLICY category_read ON public.mosque_enquiry_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY settings_read ON public.mosque_enquiry_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY enquiry_read ON public.mosque_enquiries FOR SELECT TO authenticated USING (
 (account_id = auth.uid() AND NOT deleted_by_listener)
 OR EXISTS (SELECT 1 FROM public.mosque_admins ma WHERE ma.mosque_id=mosque_enquiries.mosque_id AND ma.user_id=auth.uid())
);
CREATE POLICY reply_read ON public.mosque_enquiry_replies FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.mosque_enquiries e WHERE e.id=enquiry_id)
);

CREATE FUNCTION public.create_mosque_enquiry(p_actor uuid, p_id uuid, p_mosque uuid, p_name text, p_category text, p_reason text, p_details text, p_phone text DEFAULT NULL)
RETURNS public.mosque_enquiries LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result public.mosque_enquiries; email text; allowed text[];
BEGIN
 SELECT u.email INTO email FROM auth.users u WHERE u.id=p_actor AND u.email_confirmed_at IS NOT NULL AND NOT coalesce(u.is_anonymous,false);
 IF email IS NULL THEN RAISE EXCEPTION 'A confirmed account email is required' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_mosque IS NULL OR p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 120 OR p_details IS NULL OR char_length(p_details)>2000
 OR (p_phone IS NOT NULL AND char_length(btrim(p_phone)) NOT BETWEEN 7 AND 40) THEN
 RAISE EXCEPTION 'Please check the enquiry details' USING ERRCODE='22023'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('enquiry:'||p_actor::text||':'||p_mosque::text,0));
 SELECT * INTO result FROM public.mosque_enquiries WHERE id=p_id;
 IF FOUND THEN
   IF result.account_id IS DISTINCT FROM p_actor OR result.mosque_id<>p_mosque THEN RAISE EXCEPTION 'Invalid request reference' USING ERRCODE='42501'; END IF;
   RETURN result;
 END IF;
 SELECT enabled_categories INTO allowed FROM public.mosque_enquiry_settings WHERE mosque_id=p_mosque FOR SHARE;
 IF allowed IS NULL THEN SELECT array_agg(id) INTO allowed FROM public.mosque_enquiry_categories WHERE enabled_by_default; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.mosque_enquiry_categories c WHERE c.id=p_category AND c.id=ANY(allowed) AND p_reason=ANY(c.reasons)) THEN
 RAISE EXCEPTION 'This enquiry option is not available at this mosque' USING ERRCODE='22023'; END IF;
 IF p_category IN ('feedback','other') AND char_length(btrim(p_details))<5 THEN RAISE EXCEPTION 'Please add a short explanation' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM public.mosque_enquiries WHERE account_id=p_actor AND mosque_id=p_mosque AND created_at>=clock_timestamp()-interval '24 hours')>=5 THEN
 RAISE EXCEPTION 'You can submit up to five enquiries to this mosque in 24 hours' USING ERRCODE='P0429'; END IF;
 INSERT INTO public.mosque_enquiries(id,mosque_id,account_id,contact_name,contact_email,email_verified,callback_phone,category,reason,details)
 VALUES(p_id,p_mosque,p_actor,btrim(p_name),email,true,nullif(btrim(p_phone),''),p_category,p_reason,btrim(p_details)) RETURNING * INTO result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.create_mosque_enquiry(uuid,uuid,uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_mosque_enquiry(uuid,uuid,uuid,text,text,text,text,text) TO service_role;

CREATE FUNCTION public.reply_mosque_enquiry(p_actor uuid,p_enquiry uuid,p_id uuid,p_body text,p_as_admin boolean)
RETURNS public.mosque_enquiry_replies LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.mosque_enquiries; result public.mosque_enquiry_replies;
BEGIN
 IF p_actor IS NULL OR p_id IS NULL OR p_as_admin IS NULL OR p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Invalid reply' USING ERRCODE='22023'; END IF;
 SELECT * INTO e FROM public.mosque_enquiries WHERE id=p_enquiry FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Enquiry not found' USING ERRCODE='P0404'; END IF;
 IF p_as_admin THEN
 IF NOT EXISTS(SELECT 1 FROM public.mosque_admins WHERE mosque_id=e.mosque_id AND user_id=p_actor) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 ELSE
 IF e.account_id IS DISTINCT FROM p_actor OR e.deleted_by_listener THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 END IF;
 SELECT * INTO result FROM public.mosque_enquiry_replies WHERE id=p_id;
 IF FOUND THEN
 IF result.enquiry_id<>p_enquiry OR result.sender_id IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'Invalid reply reference' USING ERRCODE='42501'; END IF;
 RETURN result; END IF;
 IF e.status='resolved' THEN RAISE EXCEPTION 'This enquiry is resolved. Reopen it before replying.' USING ERRCODE='22023'; END IF;
 -- Serialize across all enquiries for the same listener/mosque, not just one request.
 IF NOT p_as_admin THEN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('enquiry-reply:'||p_actor::text||':'||e.mosque_id::text,0));
 IF (SELECT count(*) FROM public.mosque_enquiry_replies r JOIN public.mosque_enquiries q ON q.id=r.enquiry_id WHERE r.sender_id=p_actor AND r.sender_type='listener' AND q.mosque_id=e.mosque_id AND r.created_at>=clock_timestamp()-interval '24 hours')>=20 THEN
 RAISE EXCEPTION 'Daily follow-up limit reached. Please wait before replying again.' USING ERRCODE='P0429'; END IF;
 END IF;
 INSERT INTO public.mosque_enquiry_replies(id,enquiry_id,sender_id,sender_type,body) VALUES(p_id,p_enquiry,p_actor,CASE WHEN p_as_admin THEN 'admin' ELSE 'listener' END,btrim(p_body)) RETURNING * INTO result;
 UPDATE public.mosque_enquiries SET updated_at=clock_timestamp(),archived_by_admin=false,status=CASE WHEN p_as_admin THEN 'waiting_for_listener' ELSE 'in_progress' END WHERE id=p_enquiry;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.reply_mosque_enquiry(uuid,uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reply_mosque_enquiry(uuid,uuid,uuid,text,boolean) TO service_role;

CREATE FUNCTION public.manage_mosque_enquiry(p_id uuid,p_action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.mosque_enquiries; actor uuid:=auth.uid(); admin boolean;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 SELECT * INTO e FROM public.mosque_enquiries WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Enquiry not found' USING ERRCODE='P0404'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.mosque_admins WHERE mosque_id=e.mosque_id AND user_id=actor) INTO admin;
 IF p_action='delete' AND e.account_id=actor THEN
 UPDATE public.mosque_enquiries SET deleted_by_listener=true WHERE id=p_id;
 ELSIF admin AND p_action IN ('new','in_progress','waiting_for_listener','resolved') THEN
 UPDATE public.mosque_enquiries SET status=p_action,updated_at=clock_timestamp(),archived_by_admin=false WHERE id=p_id;
 ELSIF admin AND p_action IN ('archive','restore') THEN
 UPDATE public.mosque_enquiries SET archived_by_admin=(p_action='archive') WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.manage_mosque_enquiry(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_mosque_enquiry(uuid,text) TO authenticated;

CREATE FUNCTION public.configure_mosque_enquiries(p_mosque uuid,p_categories text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.mosque_admins WHERE mosque_id=p_mosque AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 IF p_categories IS NULL OR NOT ('other'=ANY(p_categories)) OR EXISTS(SELECT 1 FROM unnest(p_categories) v WHERE v IS NULL OR NOT EXISTS(SELECT 1 FROM public.mosque_enquiry_categories c WHERE c.id=v)) THEN RAISE EXCEPTION 'Invalid categories; Other enquiry must remain available' USING ERRCODE='22023'; END IF;
 INSERT INTO public.mosque_enquiry_settings(mosque_id,enabled_categories) VALUES(p_mosque,p_categories)
 ON CONFLICT(mosque_id) DO UPDATE SET enabled_categories=excluded.enabled_categories,updated_at=now();
END; $$;
REVOKE ALL ON FUNCTION public.configure_mosque_enquiries(uuid,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.configure_mosque_enquiries(uuid,text[]) TO authenticated;

INSERT INTO public.mosque_enquiry_categories VALUES
('prayer_facilities','Prayer & mosque facilities',ARRAY['Prayer or Jumu’ah arrangements','Eid arrangements','Opening hours','Women’s facilities','Accessibility'],true),
('education','Classes & Islamic education',ARRAY['Children’s enrolment','Adult Qur’an classes','Arabic or Islamic studies','Class times or fees'],false),
('nikah','Nikah & marriage arrangements',ARRAY['Availability','Requirements or documents','Fees','Request an appointment'],false),
('funeral','Funeral & bereavement',ARRAY['Funeral arrangements','Janazah prayer','Burial information'],false),
('new_muslim','New to Islam / Shahadah',ARRAY['Learn about Islam','Arrange Shahadah','Beginner classes','Arrange a first visit'],false),
('practical_support','Financial & practical support',ARRAY['Food support','Ask about financial assistance','Ask about Zakat assistance'],false),
('donations_volunteering','Donations & volunteering',ARRAY['Donation information','Donation query or receipt','Volunteer','Help with an activity'],true),
('events_visits','Events, visits & venue hire',ARRAY['Event enquiry','School or group visit','Venue availability','Booking requirements'],false),
('feedback','Feedback / report a problem',ARRAY['Facilities or cleanliness','Incorrect published information','Suggestion','General feedback'],true),
('other','Other enquiry',ARRAY['Something else'],true);
