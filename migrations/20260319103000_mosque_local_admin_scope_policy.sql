-- Per-mosque control over whether local admins may hold access for multiple mosques.
-- Additive and idempotent: adds the policy column and enforces compatibility on future writes.

alter table public.mosques
  add column if not exists allow_multi_mosque_local_admins boolean not null default false;

comment on column public.mosques.allow_multi_mosque_local_admins is
  'When true, local admins assigned to this mosque may also hold mosque_admins assignments for other mosques that allow the same.';

create or replace function public.enforce_mosque_admin_scope_policy()
returns trigger
language plpgsql
as $$
declare
  target_allows_multi boolean := false;
  target_name text := 'Selected mosque';
  blocking_name text := null;
begin
  if new.user_id is null or new.mosque_id is null then
    return new;
  end if;

  select
    coalesce(m.allow_multi_mosque_local_admins, false),
    coalesce(nullif(trim(m.name), ''), 'Selected mosque')
  into target_allows_multi, target_name
  from public.mosques m
  where m.id = new.mosque_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'The selected mosque could not be found.';
  end if;

  if exists (
    select 1
    from public.mosque_admins ma
    where ma.user_id = new.user_id
      and ma.mosque_id <> new.mosque_id
      and (new.id is null or ma.id <> new.id)
  ) then
    if not target_allows_multi then
      raise exception using
        errcode = 'P0001',
        message = format(
          '%s keeps local-admin access exclusive to this mosque. Remove the user''s other mosque assignments before adding them here.',
          target_name
        );
    end if;

    select coalesce(nullif(trim(m.name), ''), 'another mosque')
    into blocking_name
    from public.mosque_admins ma
    join public.mosques m on m.id = ma.mosque_id
    where ma.user_id = new.user_id
      and ma.mosque_id <> new.mosque_id
      and coalesce(m.allow_multi_mosque_local_admins, false) = false
      and (new.id is null or ma.id <> new.id)
    order by m.name
    limit 1;

    if blocking_name is not null then
      raise exception using
        errcode = 'P0001',
        message = format(
          'This user already manages %s, where cross-mosque local-admin access is inactive. Remove that assignment before adding another mosque.',
          blocking_name
        );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_mosque_admin_scope_policy on public.mosque_admins;
create trigger trg_enforce_mosque_admin_scope_policy
before insert or update of user_id, mosque_id on public.mosque_admins
for each row
execute function public.enforce_mosque_admin_scope_policy();

create or replace function public.enforce_mosque_local_admin_policy_updates()
returns trigger
language plpgsql
as $$
declare
  conflicting_user text := null;
  conflicting_mosque text := null;
begin
  if coalesce(new.allow_multi_mosque_local_admins, false) then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and coalesce(old.allow_multi_mosque_local_admins, false) = coalesce(new.allow_multi_mosque_local_admins, false) then
    return new;
  end if;

  select
    coalesce(nullif(trim(u.email), ''), ma.user_id::text),
    coalesce(nullif(trim(other_mosque.name), ''), 'another mosque')
  into conflicting_user, conflicting_mosque
  from public.mosque_admins ma
  join public.mosque_admins other_ma
    on other_ma.user_id = ma.user_id
   and other_ma.mosque_id <> new.id
  left join public.users u on u.id = ma.user_id
  left join public.mosques other_mosque on other_mosque.id = other_ma.mosque_id
  where ma.mosque_id = new.id
  limit 1;

  if conflicting_user is not null then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Cross-mosque local-admin access cannot be set to inactive while %s also manages %s. Remove the extra mosque assignment first.',
        conflicting_user,
        conflicting_mosque
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_mosque_local_admin_policy_updates on public.mosques;
create trigger trg_enforce_mosque_local_admin_policy_updates
before insert or update of allow_multi_mosque_local_admins on public.mosques
for each row
execute function public.enforce_mosque_local_admin_policy_updates();
