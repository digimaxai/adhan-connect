-- Explicit activation gate, separate from mosque_adhan_audio_settings (whose own
-- comment says it "Must never be consumed by a scheduler until a separately
-- reviewed activation mechanism exists"). Editing a draft never changes live
-- behaviour; only this deliberate, audited action does. The planner (next
-- migration) only ever reads mosques with active = true here.
begin;

create table public.mosque_adhan_audio_activation (
  mosque_id uuid primary key references public.mosques(id) on delete cascade,
  active boolean not null default false,
  activated_by uuid references public.users(id) on delete set null,
  activated_at timestamptz,
  deactivated_by uuid references public.users(id) on delete set null,
  deactivated_at timestamptz,
  updated_at timestamptz not null default now(),
  check (active = (activated_at is not null) or not active)
);
alter table public.mosque_adhan_audio_activation enable row level security;
revoke all on public.mosque_adhan_audio_activation from public, anon, authenticated, service_role;
grant select on public.mosque_adhan_audio_activation to service_role;

create function public.activate_adhan_audio_v1(p_actor uuid, p_mosque uuid, p_expected_settings_revision bigint)
returns public.mosque_adhan_audio_activation language plpgsql security definer set search_path = '' as $$
declare
  v_settings public.mosque_adhan_audio_settings;
  v_asset public.adhan_audio_assets;
  v_row public.mosque_adhan_audio_activation;
  v_now timestamptz := clock_timestamp();
begin
  perform public.assert_adhan_audio_admin(p_actor, p_mosque);
  select * into v_settings from public.mosque_adhan_audio_settings where mosque_id = p_mosque;
  if not found or v_settings.draft_mode = 'live_only' then
    raise exception 'Choose recorded or hybrid mode and save it before activating.' using errcode = '22023';
  end if;
  if v_settings.revision <> p_expected_settings_revision then
    raise exception 'Settings changed since you last loaded them. Reload before activating.' using errcode = '40001';
  end if;
  if v_settings.enabled_prayers is null or array_length(v_settings.enabled_prayers, 1) is null then
    raise exception 'Enable at least one prayer before activating.' using errcode = '22023';
  end if;
  select * into v_asset from public.adhan_audio_assets
    where id = v_settings.default_asset_id and state = 'ready' and rights_confirmed
      and (mosque_id = p_mosque or mosque_id is null);
  if not found then
    raise exception 'The selected default recording is no longer ready. Choose a valid recording before activating.' using errcode = '22023';
  end if;
  if v_settings.fajr_asset_id is not null then
    if not exists (select 1 from public.adhan_audio_assets where id = v_settings.fajr_asset_id
        and state = 'ready' and rights_confirmed and (mosque_id = p_mosque or mosque_id is null)) then
      raise exception 'The selected Fajr recording is no longer ready. Choose a valid recording before activating.' using errcode = '22023';
    end if;
  end if;

  insert into public.mosque_adhan_audio_activation (mosque_id, active, activated_by, activated_at, updated_at)
  values (p_mosque, true, p_actor, v_now, v_now)
  on conflict (mosque_id) do update set active = true, activated_by = p_actor, activated_at = v_now,
    deactivated_by = null, deactivated_at = null, updated_at = v_now
  returning * into v_row;
  insert into public.adhan_audio_audit(actor_id, mosque_id, action, details)
    values (p_actor, p_mosque, 'activated', jsonb_build_object('settings_revision', v_settings.revision, 'mode', v_settings.draft_mode));
  return v_row;
end;
$$;

-- Deactivation cancels not-yet-started planned occurrences for this mosque so
-- nothing the admin just turned off can still fire; it never touches an
-- occurrence already claimed/started, matching cancel_adhan_delivery_v1's own
-- scope for a single occurrence.
create function public.deactivate_adhan_audio_v1(p_actor uuid, p_mosque uuid)
returns public.mosque_adhan_audio_activation language plpgsql security definer set search_path = '' as $$
declare v_row public.mosque_adhan_audio_activation; v_now timestamptz := clock_timestamp(); v_cancelled integer;
begin
  perform public.assert_adhan_audio_admin(p_actor, p_mosque);
  insert into public.mosque_adhan_audio_activation (mosque_id, active, deactivated_by, deactivated_at, updated_at)
  values (p_mosque, false, p_actor, v_now, v_now)
  on conflict (mosque_id) do update set active = false, deactivated_by = p_actor, deactivated_at = v_now, updated_at = v_now
  returning * into v_row;
  with cancelled as (
    update public.adhan_delivery_occurrences set state = 'cancelled',
      reason = 'Automatic audio deactivated by mosque admin', updated_at = v_now
      where mosque_id = p_mosque and state = 'planned'
    returning 1
  )
  select count(*) into v_cancelled from cancelled;
  insert into public.adhan_audio_audit(actor_id, mosque_id, action, details)
    values (p_actor, p_mosque, 'deactivated', jsonb_build_object('cancelled_occurrences', v_cancelled));
  return v_row;
end;
$$;

revoke all on function public.activate_adhan_audio_v1(uuid,uuid,bigint) from public, anon, authenticated;
revoke all on function public.deactivate_adhan_audio_v1(uuid,uuid) from public, anon, authenticated;
grant execute on function public.activate_adhan_audio_v1(uuid,uuid,bigint) to service_role;
grant execute on function public.deactivate_adhan_audio_v1(uuid,uuid) to service_role;

comment on table public.mosque_adhan_audio_activation is
  'The only thing a scheduler/planner may read to decide a mosque is live. mosque_adhan_audio_settings is draft-only and must never be read directly for that decision.';
commit;
