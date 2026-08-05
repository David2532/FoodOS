begin;

create extension if not exists pgtap with schema extensions;

select plan(23);

select is(
  (select owner_role.rolname
   from pg_catalog.pg_proc function_record
   join pg_catalog.pg_namespace namespace_record on namespace_record.oid = function_record.pronamespace
   join pg_catalog.pg_roles owner_role on owner_role.oid = function_record.proowner
   where namespace_record.nspname = 'public' and function_record.proname = 'has_aal2'),
  'postgres',
  'has_aal2 is owned by postgres'
);
select ok(
  (select function_record.prosecdef
   from pg_catalog.pg_proc function_record
   join pg_catalog.pg_namespace namespace_record on namespace_record.oid = function_record.pronamespace
   where namespace_record.nspname = 'public' and function_record.proname = 'has_aal2'),
  'has_aal2 is a security-definer boundary'
);
select is(
  (select function_record.provolatile::text
   from pg_catalog.pg_proc function_record
   join pg_catalog.pg_namespace namespace_record on namespace_record.oid = function_record.pronamespace
   where namespace_record.nspname = 'public' and function_record.proname = 'has_aal2'),
  's',
  'has_aal2 is stable'
);
select is(
  (select coalesce(array_to_string(function_record.proconfig, ','), '')
   from pg_catalog.pg_proc function_record
   join pg_catalog.pg_namespace namespace_record on namespace_record.oid = function_record.pronamespace
   where namespace_record.nspname = 'public' and function_record.proname = 'has_aal2'),
  'search_path=""',
  'has_aal2 has an empty search path'
);
select ok(has_function_privilege('authenticated', 'public.has_aal2()', 'execute'), 'authenticated can evaluate its live AAL2 session');
select ok(not has_function_privilege('anon', 'public.has_aal2()', 'execute'), 'anonymous cannot execute has_aal2');
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc function_record,
      lateral pg_catalog.aclexplode(coalesce(
        function_record.proacl,
        pg_catalog.acldefault('f', function_record.proowner)
      )) privilege_record
    where function_record.oid = 'public.has_aal2()'::regprocedure
      and privilege_record.grantee = 0
      and privilege_record.privilege_type = 'EXECUTE'
  ),
  'PUBLIC cannot execute has_aal2'
);
select ok(not has_function_privilege('service_role', 'public.has_aal2()', 'execute'), 'service_role has no direct session-probe grant');
select ok(not has_table_privilege('authenticated', 'auth.sessions', 'select'), 'authenticated cannot read auth.sessions');
select ok(
  (select count(*) > 0
     and bool_and(policy_record.permissive = 'RESTRICTIVE')
     and bool_and(
       (policy_record.qual is null or policy_record.qual ilike '%select%has_aal2%')
       and (policy_record.with_check is null or policy_record.with_check ilike '%select%has_aal2%')
     )
   from pg_catalog.pg_policies policy_record
   where policy_record.schemaname = 'public'
     and (policy_record.policyname = 'require_aal2' or policy_record.policyname ~ '_require_aal2$')),
  'all require_aal2 policies are restrictive InitPlan checks'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('c1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'session-a@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('c1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'session-b@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into auth.sessions (id, user_id, created_at, updated_at, aal, not_after)
values
  ('c1100000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', now(), now(), 'aal2', now() + interval '1 day'),
  ('c1100000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', now(), now(), 'aal2', now() + interval '1 day'),
  ('c1100000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000002', now(), now(), 'aal2', now() + interval '1 day'),
  ('c1100000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', now(), now(), 'aal1', now() + interval '1 day'),
  ('c1100000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', now(), now(), 'aal2', now() - interval '1 minute');

select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"c1100000-0000-4000-8000-000000000001"}', true);
set local role authenticated;
select ok(public.has_aal2(), 'the first live AAL2 session is accepted');

reset role;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"c1100000-0000-4000-8000-000000000002"}', true);
set local role authenticated;
select ok(public.has_aal2(), 'a parallel live AAL2 session is accepted');

reset role;
delete from auth.sessions where id = 'c1100000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"c1100000-0000-4000-8000-000000000001"}', true);
set local role authenticated;
select ok(not public.has_aal2(), 'a revoked session is rejected even while its JWT claims remain valid');
select results_eq(
  $$ select count(*)::bigint from public.profiles $$,
  $$ values (0::bigint) $$,
  'a revoked session cannot read private rows through RLS'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"c1100000-0000-4000-8000-000000000002"}', true);
set local role authenticated;
select ok(public.has_aal2(), 'revoking one session leaves the parallel session active');

reset role;
delete from auth.sessions where id = 'c1100000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"c1100000-0000-4000-8000-000000000002"}', true);
set local role authenticated;
select ok(not public.has_aal2(), 'global revocation rejects the second session too');

reset role;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"c1100000-0000-4000-8000-000000000003"}', true);
set local role authenticated;
select ok(not public.has_aal2(), 'another user session ID cannot authorize the caller');

reset role;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select ok(not public.has_aal2(), 'a missing session ID fails closed');

reset role;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"not-a-uuid"}', true);
set local role authenticated;
select ok(not public.has_aal2(), 'a malformed session ID fails closed without raising');

reset role;
select set_config('request.jwt.claims', '{"sub":"not-a-uuid","role":"authenticated","aal":"aal2","session_id":"c1100000-0000-4000-8000-000000000003"}', true);
set local role authenticated;
select ok(not public.has_aal2(), 'a malformed subject fails closed without raising');

reset role;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"c1100000-0000-4000-8000-000000000004"}', true);
set local role authenticated;
select ok(not public.has_aal2(), 'a live AAL1 session does not satisfy AAL2');

reset role;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"c1100000-0000-4000-8000-000000000005"}', true);
set local role authenticated;
select ok(not public.has_aal2(), 'an explicitly expired session fails closed');

reset role;
select set_config('request.jwt.claims', '{"role":"anon","aal":"aal2","session_id":"c1100000-0000-4000-8000-000000000003"}', true);
select ok(not public.has_aal2(), 'claims without an authenticated user fail closed');

select * from finish();
rollback;
