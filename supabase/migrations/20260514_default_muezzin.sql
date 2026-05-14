-- Mosque-level fallback muezzin assignment.
-- When a prayer/date has no explicit staff_rota row, this active muezzin is
-- treated as the effective assignee for go-live and My Rota surfaces.

alter table public.mosques
  add column if not exists default_muezzin_user_id uuid references auth.users(id) on delete set null;

comment on column public.mosques.default_muezzin_user_id is
  'Active muezzin used as the fallback assignee when no explicit staff_rota row exists for a prayer/date.';

create index if not exists idx_mosques_default_muezzin
  on public.mosques(default_muezzin_user_id)
  where default_muezzin_user_id is not null;

grant select (default_muezzin_user_id) on public.mosques to authenticated;
