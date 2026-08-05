begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select ok(
  pg_get_indexdef('public.household_invitations_created_by_idx'::regclass) like '% USING btree (created_by)'
    and pg_get_indexdef('public.household_invitations_created_by_idx'::regclass) not like '% WHERE %',
  'invitation creator foreign key has a complete B-tree index'
);
select ok(
  pg_get_indexdef('public.household_invitations_accepted_by_idx'::regclass) like '% USING btree (accepted_by)'
    and pg_get_indexdef('public.household_invitations_accepted_by_idx'::regclass) not like '% WHERE %',
  'invitation accepter foreign key has a complete B-tree index'
);
select ok(
  pg_get_indexdef('public.household_invitations_revoked_by_idx'::regclass) like '% USING btree (revoked_by)'
    and pg_get_indexdef('public.household_invitations_revoked_by_idx'::regclass) not like '% WHERE %',
  'invitation revoker foreign key has a complete B-tree index'
);
select ok(
  pg_get_indexdef('public.household_members_removed_by_idx'::regclass) like '% USING btree (removed_by)'
    and pg_get_indexdef('public.household_members_removed_by_idx'::regclass) not like '% WHERE %',
  'membership remover foreign key has a complete B-tree index'
);

select ok((
  select count(*) = 3 and bool_and(class.relrowsecurity)
  from pg_catalog.pg_class class
  join pg_catalog.pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname in ('household_membership_state', 'account_entitlements', 'household_invitations')
), 'all three internal lifecycle tables keep RLS enabled');

select is((
  select count(*)::integer
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename in ('household_membership_state', 'account_entitlements', 'household_invitations')
), 0, 'the internal lifecycle tables intentionally expose no client RLS policy');

select ok((
  select bool_and(
    not has_table_privilege(role_name, table_name, 'select')
    and not has_table_privilege(role_name, table_name, 'insert')
    and not has_table_privilege(role_name, table_name, 'update')
    and not has_table_privilege(role_name, table_name, 'delete')
    and not has_table_privilege(role_name, table_name, 'truncate')
    and not has_table_privilege(role_name, table_name, 'references')
    and not has_table_privilege(role_name, table_name, 'trigger')
  )
  from (values ('anon'), ('authenticated')) roles(role_name)
  cross join (values
    ('public.household_membership_state'),
    ('public.account_entitlements'),
    ('public.household_invitations')
  ) tables(table_name)
), 'anon and authenticated have no direct privilege on internal lifecycle tables');

select ok((
  with expected(signature) as (values
    ('public.get_my_households()'),
    ('public.get_household_members(uuid)'),
    ('public.list_household_invitations(uuid)'),
    ('public.create_household_invitation(uuid,bigint,integer)'),
    ('public.accept_household_invitation(text)'),
    ('public.revoke_household_invitation(uuid,uuid,bigint)'),
    ('public.remove_household_member(uuid,uuid,bigint)'),
    ('public.leave_household(uuid,bigint)'),
    ('public.transfer_household_ownership(uuid,uuid,bigint)')
  )
  select count(*) = 9 and bool_and(
    procedure.prosecdef
    and procedure.proowner = 'postgres'::regrole
    and coalesce(array_to_string(procedure.proconfig, ','), '') like '%search_path=""%'
  )
  from expected
  join pg_catalog.pg_proc procedure on procedure.oid = expected.signature::regprocedure
), 'every lifecycle RPC is postgres-owned SECURITY DEFINER with an empty search path');

select ok((
  with expected(signature) as (values
    ('public.get_my_households()'),
    ('public.get_household_members(uuid)'),
    ('public.list_household_invitations(uuid)'),
    ('public.create_household_invitation(uuid,bigint,integer)'),
    ('public.accept_household_invitation(text)'),
    ('public.revoke_household_invitation(uuid,uuid,bigint)'),
    ('public.remove_household_member(uuid,uuid,bigint)'),
    ('public.leave_household(uuid,bigint)'),
    ('public.transfer_household_ownership(uuid,uuid,bigint)')
  )
  select count(*) = 9 and bool_and(
    has_function_privilege('authenticated', expected.signature, 'execute')
    and not has_function_privilege('anon', expected.signature, 'execute')
    and not has_function_privilege('service_role', expected.signature, 'execute')
  )
  from expected
), 'authenticated is the only client role with execute on lifecycle RPCs');

select ok((
  select count(*) = 12 and bool_and(description is not null and length(description) > 20)
  from (
    select obj_description(table_oid, 'pg_class') as description
    from (values
      ('public.household_membership_state'::regclass),
      ('public.account_entitlements'::regclass),
      ('public.household_invitations'::regclass)
    ) tables(table_oid)
    union all
    select obj_description(procedure_oid, 'pg_proc')
    from (values
      ('public.get_my_households()'::regprocedure),
      ('public.get_household_members(uuid)'::regprocedure),
      ('public.list_household_invitations(uuid)'::regprocedure),
      ('public.create_household_invitation(uuid,bigint,integer)'::regprocedure),
      ('public.accept_household_invitation(text)'::regprocedure),
      ('public.revoke_household_invitation(uuid,uuid,bigint)'::regprocedure),
      ('public.remove_household_member(uuid,uuid,bigint)'::regprocedure),
      ('public.leave_household(uuid,bigint)'::regprocedure),
      ('public.transfer_household_ownership(uuid,uuid,bigint)'::regprocedure)
    ) procedures(procedure_oid)
  ) documented
), 'deny-all tables and intentional SECURITY DEFINER RPCs are documented in schema metadata');

select * from finish();
rollback;
