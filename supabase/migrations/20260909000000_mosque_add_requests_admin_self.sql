-- Adds a third request type for mosque committee members / admins who want to
-- self-register their mosque. This is treated as a high-priority lead because
-- the submitter is the decision-maker, not a third-party listener.
--
-- Also adds submitter_role_at_mosque so the admin panel can display the
-- person's role without parsing free-text notes.

ALTER TABLE public.mosque_add_requests
  DROP CONSTRAINT mosque_add_requests_request_type_check;

ALTER TABLE public.mosque_add_requests
  ADD CONSTRAINT mosque_add_requests_request_type_check
  CHECK (request_type IN ('invite_known_mosque', 'request_new_mosque', 'mosque_admin_self'));

ALTER TABLE public.mosque_add_requests
  ADD COLUMN IF NOT EXISTS submitter_role_at_mosque text;

COMMENT ON COLUMN public.mosque_add_requests.submitter_role_at_mosque IS
  'For mosque_admin_self requests: the submitter''s role at the mosque (e.g. Imam, Secretary, Trustee).';
