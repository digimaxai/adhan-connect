-- Additive RLS policies to allow inserts into streams for muezzins and admins.
-- Resolves cases where upsert fails because insert was previously disallowed.

-- Muezzin insert: allow active muezzin on the same mosque to insert streams rows.
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'streams' and policyname = 'streams muezzin insert own mosque'
  ) then
    create policy "streams muezzin insert own mosque" on streams
      for insert with check (
        exists (
          select 1 from muezzins m
          where m.user_id = auth.uid()
            and m.mosque_id = streams.mosque_id
            and m.is_active = true
        )
      );
  end if;
end$$;

-- Admin insert: allow local/main admins to insert for their mosques.
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'streams' and policyname = 'streams admin insert'
  ) then
    create policy "streams admin insert" on streams
      for insert with check (
        exists (
          select 1 from mosque_admins ma
          where ma.user_id = auth.uid()
            and ma.mosque_id = streams.mosque_id
        )
      );
  end if;
end$$;
