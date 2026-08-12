begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
  ),
  'Q-SEC-RPC-DB-001: anon cannot execute any SECURITY DEFINER FoodOS function'
);

select ok(
  has_function_privilege('authenticated', 'public.onboard_household(text,text,integer,numeric)'::regprocedure, 'execute')
  and has_function_privilege('authenticated', 'public.add_inventory_batch(uuid,jsonb,jsonb,uuid)'::regprocedure, 'execute')
  and has_function_privilege('authenticated', 'public.commit_purchase_capture(uuid,jsonb,uuid)'::regprocedure, 'execute')
  and has_function_privilege('authenticated', 'public.consume_inventory_batch_v2(uuid,numeric,uuid,boolean,boolean)'::regprocedure, 'execute')
  and has_function_privilege('authenticated', 'public.discard_inventory_batch(uuid,numeric,uuid)'::regprocedure, 'execute')
  and has_function_privilege('authenticated', 'public.record_privacy_choices(text,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,uuid)'::regprocedure, 'execute')
  and has_function_privilege('authenticated', 'public.search_global_catalog_products(text,integer)'::regprocedure, 'execute')
  and has_function_privilege('authenticated', 'public.lookup_global_catalog_product(text)'::regprocedure, 'execute'),
  'Q-SEC-RPC-DB-002: authenticated users retain the narrow FoodOS RPC surface'
);

select ok(
  not has_function_privilege('authenticated', 'public.create_household(text)'::regprocedure, 'execute')
  and not has_function_privilege('authenticated', 'public.activate_product_catalog_import(uuid)'::regprocedure, 'execute')
  and not has_function_privilege('authenticated', 'public.seal_product_catalog_import_batch(uuid)'::regprocedure, 'execute')
  and not has_function_privilege('authenticated', 'public.inspect_product_catalog_import(uuid)'::regprocedure, 'execute'),
  'Q-SEC-RPC-DB-003: legacy and catalog-administration RPCs are not client-callable'
);

select ok(
  not has_schema_privilege('authenticated', 'inventory_private', 'usage')
  and not exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'inventory_private'
      and has_function_privilege('authenticated', procedure.oid, 'execute')
  ),
  'Q-SEC-RPC-DB-004: authenticated clients cannot invoke inventory payload validators directly'
);

select ok(
  exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where procedure.oid = 'public.commit_purchase_capture(uuid,jsonb,uuid)'::regprocedure
      and namespace.nspname = 'public'
      and procedure.prosecdef
      and procedure.proowner = 'postgres'::regrole
      and coalesce(pg_catalog.array_to_string(procedure.proconfig, ','), '')
        like '%search_path=""%'
      and has_function_privilege(
        'authenticated',
        'public.commit_purchase_capture(uuid,jsonb,uuid)'::regprocedure,
        'execute'
      )
      and not has_function_privilege(
        'anon',
        'public.commit_purchase_capture(uuid,jsonb,uuid)'::regprocedure,
        'execute'
      )
      and not has_function_privilege(
        'service_role',
        'public.commit_purchase_capture(uuid,jsonb,uuid)'::regprocedure,
        'execute'
      )
  ),
  'Q-SEC-RPC-DB-005: purchase capture is a pinned security-definer boundary'
);

select ok(
  exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where procedure.oid = 'public.discard_inventory_batch(uuid,numeric,uuid)'::regprocedure
      and namespace.nspname = 'public'
      and procedure.prosecdef
      and procedure.proowner = 'postgres'::regrole
      and coalesce(pg_catalog.array_to_string(procedure.proconfig, ','), '')
        like '%search_path=""%'
      and has_function_privilege(
        'authenticated',
        'public.discard_inventory_batch(uuid,numeric,uuid)'::regprocedure,
        'execute'
      )
      and not has_function_privilege(
        'anon',
        'public.discard_inventory_batch(uuid,numeric,uuid)'::regprocedure,
        'execute'
      )
      and not has_function_privilege(
        'service_role',
        'public.discard_inventory_batch(uuid,numeric,uuid)'::regprocedure,
        'execute'
      )
  ),
  'Q-SEC-RPC-DB-008: inventory disposal is an authenticated-only pinned security-definer boundary'
);

select ok(
  (
    select
      pg_catalog.strpos(definition.body, 'from public.household_membership_state as state') > 0
      and pg_catalog.strpos(definition.body, 'from public.household_members as member')
        > pg_catalog.strpos(definition.body, 'from public.household_membership_state as state')
      and pg_catalog.strpos(definition.body, 'for share;')
        > pg_catalog.strpos(definition.body, 'from public.household_members as member')
      and pg_catalog.strpos(definition.body, 'select batch.*')
        > pg_catalog.strpos(definition.body, 'for share;')
      and pg_catalog.strpos(
        pg_catalog.substr(
          definition.body,
          pg_catalog.strpos(definition.body, 'select batch.*')
        ),
        'for update;'
      ) > 0
      and pg_catalog.strpos(definition.body, 'update public.inventory_batches')
        > pg_catalog.strpos(definition.body, 'select batch.*')
      and pg_catalog.strpos(definition.body, 'insert into public.inventory_events')
        > pg_catalog.strpos(definition.body, 'update public.inventory_batches')
    from (
      select pg_catalog.lower(pg_catalog.pg_get_functiondef(
        'public.discard_inventory_batch(uuid,numeric,uuid)'::regprocedure
      )) as body
    ) as definition
  ),
  'Q-SEC-RPC-DB-009: disposal serializes membership, batch decrement, and append-only event in canonical order'
);

select ok(
  (
    select
      pg_catalog.strpos(definition.body, 'from public.household_membership_state as state') > 0
      and pg_catalog.strpos(definition.body, 'from public.household_members as member')
        > pg_catalog.strpos(definition.body, 'from public.household_membership_state as state')
      and pg_catalog.strpos(definition.body, 'for share;')
        > pg_catalog.strpos(definition.body, 'from public.household_members as member')
      and pg_catalog.strpos(definition.body, 'pg_catalog.pg_advisory_xact_lock')
        > pg_catalog.strpos(definition.body, 'for share;')
    from (
      select pg_catalog.lower(pg_catalog.pg_get_functiondef(
        'public.commit_purchase_capture(uuid,jsonb,uuid)'::regprocedure
      )) as body
    ) as definition
  ),
  'Q-SEC-RPC-DB-006: purchase capture holds the canonical lifecycle lock before final membership recheck'
);

select ok(
  (
    select
      pg_catalog.strpos(definition.body, 'select distinct item.value') > 0
      and pg_catalog.strpos(definition.body, 'order by gtin')
        > pg_catalog.strpos(definition.body, 'select distinct item.value')
      and pg_catalog.strpos(definition.body, 'pg_catalog.pg_advisory_xact_lock')
        > pg_catalog.strpos(definition.body, 'order by gtin')
      and pg_catalog.strpos(
        pg_catalog.substr(
          definition.body,
          pg_catalog.strpos(definition.body, 'from public.products as product')
        ),
        'for update;'
      ) > 0
    from (
      select pg_catalog.lower(pg_catalog.pg_get_functiondef(
        'public.commit_purchase_capture(uuid,jsonb,uuid)'::regprocedure
      )) as body
    ) as definition
  ),
  'Q-SEC-RPC-DB-007: unique GTIN locks are sorted before each matching product row lock'
);

select * from finish();
rollback;
