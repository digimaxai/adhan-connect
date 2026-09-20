-- Preparation only: no existing tables, triggers, cron jobs or live APIs change.
-- Private drafts deliberately do not reuse legacy recorded_adhans public reads.
begin;

create table public.adhan_audio_assets (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid references public.mosques(id) on delete cascade, -- null = centrally curated catalogue
  title text not null check (length(trim(title)) between 1 and 120),
  reciter text not null check (length(trim(reciter)) between 1 and 120),
  state text not null default 'uploading' check (state in ('uploading','ready','archived')),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('audio/mpeg','audio/mp4','audio/wav')),
  size_bytes integer not null check (size_bytes between 1 and 20971520),
  duration_sec integer check (duration_sec between 1 and 600),
  rights_confirmed boolean not null check (rights_confirmed),
  rights_note text not null check (length(trim(rights_note)) between 1 and 500),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (state <> 'ready' or duration_sec is not null)
);
create index on public.adhan_audio_assets (mosque_id, state);

create table public.mosque_adhan_audio_settings (
  mosque_id uuid primary key references public.mosques(id) on delete cascade,
  draft_mode text not null default 'live_only' check (draft_mode in ('live_only','recorded_only','live_with_fallback')),
  default_asset_id uuid references public.adhan_audio_assets(id),
  fajr_asset_id uuid references public.adhan_audio_assets(id),
  enabled_prayers text[] not null default array['fajr','dhuhr','asr','maghrib','isha'],
  revision bigint not null default 1 check (revision > 0),
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (cardinality(enabled_prayers) between 1 and 5 and
    enabled_prayers <@ array['fajr','dhuhr','asr','maghrib','isha'] and array_position(enabled_prayers, null) is null),
  check (draft_mode = 'live_only' or default_asset_id is not null)
);
comment on table public.mosque_adhan_audio_settings is
  'Inactive admin preparation. Must never be consumed by a scheduler until a separately reviewed activation mechanism exists.';

create table public.adhan_audio_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  mosque_id uuid references public.mosques(id) on delete cascade,
  action text not null,
  details jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.adhan_audio_assets enable row level security;
alter table public.mosque_adhan_audio_settings enable row level security;
alter table public.adhan_audio_audit enable row level security;
revoke all on public.adhan_audio_assets, public.mosque_adhan_audio_settings, public.adhan_audio_audit from public, anon, authenticated;
grant select on public.adhan_audio_assets, public.mosque_adhan_audio_settings, public.adhan_audio_audit to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adhan-audio', 'adhan-audio', false, 20971520, array['audio/mpeg','audio/mp4','audio/wav']);
-- Restrictive guard also denies access if a legacy permissive storage policy
-- matches every bucket. Its condition is true for all existing buckets.
create policy adhan_audio_private_guard on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'adhan-audio') with check (bucket_id <> 'adhan-audio');
-- API-issued signed uploads and previews only.

create function public.assert_adhan_audio_admin(p_actor uuid, p_mosque uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.users where id = p_actor and role::text = 'main_admin') and
    (p_mosque is null or not exists (
      select 1 from public.mosque_admins where user_id = p_actor and mosque_id = p_mosque
    )) then
    raise exception 'Mosque admin access required' using errcode = '42501';
  end if;
end;
$$;

-- Serialize these low-frequency admin mutations, including catalogue selections
-- across mosques. This prevents save/archive and quota races without touching live.
create function public.reserve_adhan_audio_upload(
  p_actor uuid, p_mosque uuid, p_title text, p_reciter text,
  p_mime text, p_size integer, p_rights_note text
) returns public.adhan_audio_assets language plpgsql security definer set search_path = '' as $$
declare
  v_asset public.adhan_audio_assets;
  v_id uuid := gen_random_uuid();
begin
  perform public.assert_adhan_audio_admin(p_actor, p_mosque);
  perform pg_advisory_xact_lock(923202601::bigint);
  if (select count(*) from public.adhan_audio_assets
      where mosque_id is not distinct from p_mosque and state <> 'archived') >=
      (case when p_mosque is null then 5 else 20 end) then
    raise exception 'Recording limit reached; archive an unused recording first' using errcode = 'P0001';
  end if;
  insert into public.adhan_audio_assets
    (id, mosque_id, title, reciter, storage_path, mime_type, size_bytes, rights_confirmed, rights_note, created_by)
  values (v_id, p_mosque, p_title, p_reciter,
    coalesce(p_mosque::text, 'catalogue') || '/' || v_id::text ||
      case p_mime when 'audio/mpeg' then '.mp3' when 'audio/mp4' then '.m4a' else '.wav' end,
    p_mime, p_size, true, p_rights_note, p_actor) returning * into v_asset;
  insert into public.adhan_audio_audit(actor_id, mosque_id, action, details)
    values (p_actor, p_mosque, 'upload_reserved', jsonb_build_object('asset_id', v_id));
  return v_asset;
end;
$$;

create function public.complete_adhan_audio_upload(p_actor uuid, p_asset uuid, p_duration integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_asset public.adhan_audio_assets;
begin
  perform pg_advisory_xact_lock(923202601::bigint);
  select * into v_asset from public.adhan_audio_assets where id = p_asset;
  if not found then raise exception 'Recording not found' using errcode = 'P0002'; end if;
  perform public.assert_adhan_audio_admin(p_actor, v_asset.mosque_id);
  if v_asset.state = 'ready' then return; end if; -- idempotent retry
  if v_asset.state <> 'uploading' then raise exception 'Recording is archived' using errcode = 'P0001'; end if;
  update public.adhan_audio_assets set state = 'ready', duration_sec = p_duration where id = p_asset;
  insert into public.adhan_audio_audit(actor_id, mosque_id, action, details)
    values (p_actor, v_asset.mosque_id, 'upload_verified', jsonb_build_object('asset_id', p_asset));
end;
$$;

create function public.save_adhan_audio_draft(
  p_actor uuid, p_mosque uuid, p_revision bigint, p_mode text,
  p_default uuid, p_fajr uuid, p_prayers text[]
) returns public.mosque_adhan_audio_settings language plpgsql security definer set search_path = '' as $$
declare
  v_old public.mosque_adhan_audio_settings;
  v_saved public.mosque_adhan_audio_settings;
  v_id uuid;
begin
  perform public.assert_adhan_audio_admin(p_actor, p_mosque);
  perform pg_advisory_xact_lock(923202601::bigint);
  select * into v_old from public.mosque_adhan_audio_settings where mosque_id = p_mosque;
  if p_revision is null or coalesce(v_old.revision, 0) <> p_revision then
    raise exception 'Settings changed; reload before saving' using errcode = '40001';
  end if;
  if cardinality(p_prayers) <> (select count(distinct x) from unnest(p_prayers) x) then
    raise exception 'Duplicate prayer selection' using errcode = '22023';
  end if;
  foreach v_id in array array[p_default, p_fajr] loop
    if v_id is not null and not exists (select 1 from public.adhan_audio_assets
      where id = v_id and state = 'ready' and rights_confirmed and (mosque_id = p_mosque or mosque_id is null)) then
      raise exception 'Choose a ready recording belonging to this mosque or the catalogue' using errcode = '22023';
    end if;
  end loop;
  insert into public.mosque_adhan_audio_settings
    (mosque_id, draft_mode, default_asset_id, fajr_asset_id, enabled_prayers, revision, updated_by)
  values (p_mosque, p_mode, p_default, p_fajr, p_prayers, p_revision + 1, p_actor)
  on conflict (mosque_id) do update set draft_mode = excluded.draft_mode,
    default_asset_id = excluded.default_asset_id, fajr_asset_id = excluded.fajr_asset_id,
    enabled_prayers = excluded.enabled_prayers, revision = excluded.revision,
    updated_by = excluded.updated_by, updated_at = now()
  returning * into v_saved;
  insert into public.adhan_audio_audit(actor_id, mosque_id, action, details)
    values (p_actor, p_mosque, 'draft_saved', jsonb_build_object('before', to_jsonb(v_old), 'after', to_jsonb(v_saved)));
  return v_saved;
end;
$$;

create function public.archive_adhan_audio_asset(p_actor uuid, p_asset uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_asset public.adhan_audio_assets;
begin
  perform pg_advisory_xact_lock(923202601::bigint);
  select * into v_asset from public.adhan_audio_assets where id = p_asset;
  if not found then raise exception 'Recording not found' using errcode = 'P0002'; end if;
  perform public.assert_adhan_audio_admin(p_actor, v_asset.mosque_id);
  if exists (select 1 from public.mosque_adhan_audio_settings where default_asset_id = p_asset or fajr_asset_id = p_asset) then
    raise exception 'Recording is selected in saved settings; replace it before archiving' using errcode = 'P0001';
  end if;
  update public.adhan_audio_assets set state = 'archived' where id = p_asset;
  insert into public.adhan_audio_audit(actor_id, mosque_id, action, details)
    values (p_actor, v_asset.mosque_id, 'archived', jsonb_build_object('asset_id', p_asset));
end;
$$;

revoke all on function public.assert_adhan_audio_admin(uuid,uuid) from public, anon, authenticated;
revoke all on function public.reserve_adhan_audio_upload(uuid,uuid,text,text,text,integer,text) from public, anon, authenticated;
revoke all on function public.complete_adhan_audio_upload(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.save_adhan_audio_draft(uuid,uuid,bigint,text,uuid,uuid,text[]) from public, anon, authenticated;
revoke all on function public.archive_adhan_audio_asset(uuid,uuid) from public, anon, authenticated;
grant execute on function public.reserve_adhan_audio_upload(uuid,uuid,text,text,text,integer,text) to service_role;
grant execute on function public.complete_adhan_audio_upload(uuid,uuid,integer) to service_role;
grant execute on function public.save_adhan_audio_draft(uuid,uuid,bigint,text,uuid,uuid,text[]) to service_role;
grant execute on function public.archive_adhan_audio_asset(uuid,uuid) to service_role;
commit;
