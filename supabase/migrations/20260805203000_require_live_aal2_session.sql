begin;

create or replace function public.has_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with request_context as (
    select auth.jwt() as claims
  ), parsed_context as (
    select
      coalesce(claims ->> 'aal', '') as aal,
      case
        when coalesce(claims ->> 'sub', '')
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (claims ->> 'sub')::uuid
        else null::uuid
      end as user_id,
      case
        when coalesce(claims ->> 'session_id', '')
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (claims ->> 'session_id')::uuid
        else null::uuid
      end as session_id
    from request_context
  )
  select coalesce(
    parsed_context.aal = 'aal2'
    and parsed_context.user_id is not null
    and parsed_context.session_id is not null
    and exists (
      select 1
      from auth.sessions as live_session
      where live_session.user_id = parsed_context.user_id
        and live_session.id = parsed_context.session_id
        and (
          live_session.not_after is null
          or live_session.not_after > pg_catalog.now()
        )
    ),
    false
  )
  from parsed_context;
$$;

alter function public.has_aal2() owner to postgres;
revoke all on function public.has_aal2() from public, anon, authenticated, service_role;
grant execute on function public.has_aal2() to authenticated;

-- Evaluate the live-session lookup once per statement instead of once per row.
do $$
declare
  target record;
begin
  for target in
    select schemaname, tablename, policyname, cmd
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and (policyname = 'require_aal2' or policyname ~ '_require_aal2$')
  loop
    if target.cmd in ('SELECT', 'DELETE') then
      execute pg_catalog.format(
        'alter policy %I on %I.%I using ((select public.has_aal2()))',
        target.policyname, target.schemaname, target.tablename
      );
    elsif target.cmd = 'INSERT' then
      execute pg_catalog.format(
        'alter policy %I on %I.%I with check ((select public.has_aal2()))',
        target.policyname, target.schemaname, target.tablename
      );
    else
      execute pg_catalog.format(
        'alter policy %I on %I.%I using ((select public.has_aal2())) with check ((select public.has_aal2()))',
        target.policyname, target.schemaname, target.tablename
      );
    end if;
  end loop;
end
$$;

commit;
