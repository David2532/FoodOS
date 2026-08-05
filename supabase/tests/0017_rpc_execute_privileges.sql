begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

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
  and has_function_privilege('authenticated', 'public.consume_inventory_batch_v2(uuid,numeric,uuid,boolean,boolean)'::regprocedure, 'execute')
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

select * from finish();
rollback;
