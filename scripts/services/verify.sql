-- All test data rolls back. Check unauthenticated visibility and write denial.
insert into public.mosque_service_listings(id,mosque_id,title,kind,action_type,action_value,status)
select 'e2a00000-0000-4000-8000-000000000001',id,'Services test draft','course','phone','+447817364400','draft' from public.mosques limit 1;
insert into public.mosque_service_listings(id,mosque_id,title,kind,action_type,action_value,status)
select 'e2a00000-0000-4000-8000-000000000002',id,'Services test public','course','phone','+447817364400','published' from public.mosques limit 1;
insert into public.mosque_service_intakes(id,service_id,mosque_id,title)
select 'e2a00000-0000-4000-8000-000000000003',id,mosque_id,'Draft intake' from public.mosque_service_listings where id='e2a00000-0000-4000-8000-000000000001';
insert into public.mosque_service_intakes(id,service_id,mosque_id,title)
select 'e2a00000-0000-4000-8000-000000000004',id,mosque_id,'Public intake' from public.mosque_service_listings where id='e2a00000-0000-4000-8000-000000000002';
set local role anon;
do $$ begin
 if exists(select 1 from public.mosque_service_listings where id='e2a00000-0000-4000-8000-000000000001') then raise exception 'Draft leaked'; end if;
 if not exists(select 1 from public.mosque_service_listings where id='e2a00000-0000-4000-8000-000000000002') then raise exception 'Published service hidden'; end if;
 if exists(select 1 from public.mosque_service_intakes where id='e2a00000-0000-4000-8000-000000000003') then raise exception 'Draft intake leaked'; end if;
 if not exists(select 1 from public.mosque_service_intakes where id='e2a00000-0000-4000-8000-000000000004') then raise exception 'Public intake hidden'; end if;
 begin
  update public.mosque_service_listings set title='Should not write' where id='e2a00000-0000-4000-8000-000000000002';
  if found then raise exception 'Anon update accepted'; end if;
 exception when insufficient_privilege then null; end;
end $$;
reset role;

-- A signed-in user without a mosque role cannot see drafts or write services.
select set_config('request.jwt.claim.sub','e2a00000-0000-4000-8000-000000000099',true);
set local role authenticated;
do $$ declare m uuid; begin
 if exists(select 1 from public.mosque_service_listings where id='e2a00000-0000-4000-8000-000000000001') then raise exception 'Draft leaked to listener'; end if;
 select mosque_id into m from public.mosque_service_listings where id='e2a00000-0000-4000-8000-000000000002';
 begin
  insert into public.mosque_service_listings(mosque_id,title,kind,action_type,action_value) values(m,'Not authorised','course','phone','+447817364400');
  raise exception 'Listener insert accepted';
 exception when insufficient_privilege then null; end;
 update public.mosque_service_listings set title='Not authorised' where id='e2a00000-0000-4000-8000-000000000002';
 if found then raise exception 'Listener update accepted'; end if;
end $$;
reset role;
-- Use an existing local-admin membership only inside this rolled-back test.
do $$ declare member record; other_mosque uuid; begin
 select ma.user_id,ma.mosque_id into member from public.mosque_admins ma
 join public.users u on u.id=ma.user_id where u.role::text <> 'main_admin'
 and exists(select 1 from public.mosques m where not exists(select 1 from public.mosque_admins x where x.user_id=ma.user_id and x.mosque_id=m.id)) limit 1;
 if member.user_id is null then raise exception 'No local-admin fixture available'; end if;
 select id into other_mosque from public.mosques m where not exists(select 1 from public.mosque_admins x where x.user_id=member.user_id and x.mosque_id=m.id) limit 1;
 perform set_config('request.jwt.claim.sub',member.user_id::text,true);
 perform set_config('test.own_mosque',member.mosque_id::text,true);
 perform set_config('test.other_mosque',other_mosque::text,true);
end $$;
set local role authenticated;
do $$ declare sid uuid; begin
 if public.is_main_admin() then raise exception 'Fixture must not be main admin'; end if;
 insert into public.mosque_service_listings(mosque_id,title,kind,action_type,action_value)
 values(current_setting('test.own_mosque')::uuid,'Owned draft','course','phone','+447817364400') returning id into sid;
 if not exists(select 1 from public.mosque_service_listings where id=sid) then raise exception 'Owner cannot read draft'; end if;
 insert into public.mosque_service_intakes(service_id,mosque_id,title)
 values(sid,current_setting('test.own_mosque')::uuid,'Owned intake');
 begin
  insert into public.mosque_service_listings(mosque_id,title,kind,action_type,action_value)
  values(current_setting('test.other_mosque')::uuid,'Cross-mosque draft','course','phone','+447817364400');
  raise exception 'Cross-mosque insert accepted';
 exception when insufficient_privilege then null; end;
 begin
  update public.mosque_service_listings set mosque_id=current_setting('test.other_mosque')::uuid where id=sid;
  raise exception 'Cross-mosque reassignment accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
