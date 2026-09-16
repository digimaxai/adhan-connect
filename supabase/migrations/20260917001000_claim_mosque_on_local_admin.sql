-- A mosque with a local admin is, by definition, claimed by its staff.
create or replace function public.mark_mosque_claimed_on_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.mosques set onboarding_status = 'claimed'
   where id = new.mosque_id and coalesce(onboarding_status, 'directory_only') <> 'claimed';
  return new;
end $$;
drop trigger if exists mosque_claimed_on_admin on public.mosque_admins;
create trigger mosque_claimed_on_admin after insert on public.mosque_admins
  for each row execute function public.mark_mosque_claimed_on_admin();
update public.mosques m set onboarding_status = 'claimed'
 where coalesce(m.onboarding_status, 'directory_only') <> 'claimed'
   and exists (select 1 from public.mosque_admins a where a.mosque_id = m.id);
