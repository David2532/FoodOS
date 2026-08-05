-- Forward-only migration: catalog_search_nutrition_summary
-- Review RLS, grants, function execution privileges and rollback/recovery impact.
-- Add or update the relevant pgTAP coverage before applying this migration.
begin;

-- Search cards need a bounded nutrition projection. The complete product remains
-- available only through the existing AAL2 product lookup; raw provider payloads stay
-- outside the client contract.
drop function public.search_cached_products(text, integer);

create function public.search_cached_products(search_text text, result_limit integer default 8)
returns table (
  barcode text,
  name text,
  brand text,
  image_url text,
  quantity text,
  nutri_score text,
  nutrition_per_100g jsonb,
  confidence numeric
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if search_text is null or char_length(btrim(search_text)) < 2 or char_length(search_text) > 80 then
    raise exception using errcode = '22023', message = 'Search text must contain 2 to 80 characters';
  end if;

  return query
  select
    product.gtin,
    product.name,
    product.brand,
    product.image_url,
    details.value_json ->> 'quantity',
    details.value_json ->> 'nutri_score',
    case
      when nutrition.basis_amount = 100 then jsonb_strip_nulls(jsonb_build_object(
        'energy_kcal_100g', nutrition.energy_kcal,
        'proteins_100g', nutrition.protein_g,
        'carbohydrates_100g', nutrition.carbohydrates_g,
        'sugars_100g', nutrition.sugars_g,
        'fat_100g', nutrition.fat_g,
        'saturated-fat_100g', nutrition.saturated_fat_g,
        'fiber_100g', nutrition.fiber_g,
        'salt_100g', nutrition.salt_g
      ))
      else '{}'::jsonb
    end,
    product.data_confidence
  from public.products product
  left join public.product_nutrition nutrition on nutrition.product_id = product.id
  left join lateral (
    select metadata.value_json
    from public.product_metadata metadata
    where metadata.product_id = product.id
      and metadata.field_key = 'catalog_details'
    order by metadata.source_updated_at desc nulls last
    limit 1
  ) details on true
  where public.is_household_member(product.household_id)
    and product.gtin is not null
    and product.search_document @@ websearch_to_tsquery('german'::regconfig, btrim(search_text))
  order by
    ts_rank_cd(product.search_document, websearch_to_tsquery('german'::regconfig, btrim(search_text))) desc,
    product.user_verified_at desc nulls last,
    product.name
  limit least(greatest(coalesce(result_limit, 8), 1), 20);
end;
$$;

revoke all on function public.search_cached_products(text, integer) from public, anon;
grant execute on function public.search_cached_products(text, integer) to authenticated;

drop function public.search_global_catalog_products(text, integer);

create function public.search_global_catalog_products(search_text text, result_limit integer default 8)
returns table (
  barcode text,
  name text,
  brand text,
  image_url text,
  quantity text,
  nutri_score text,
  nutrition_per_100g jsonb,
  confidence numeric,
  source_url text,
  source_updated_at timestamptz,
  source_retrieved_at timestamptz,
  database_license text,
  image_license text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if search_text is null or char_length(btrim(search_text)) < 2 or char_length(search_text) > 80 then
    raise exception using errcode = '22023', message = 'Search text must contain 2 to 80 characters';
  end if;

  return query
  select
    product.gtin,
    coalesce(product.name_de, product.name),
    product.brand,
    product.image_url,
    product.package_quantity,
    product.nutri_score,
    product.nutrition_per_100g,
    product.confidence,
    product.source_url,
    product.source_updated_at,
    product.source_retrieved_at,
    product.database_license,
    product.image_license
  from public.product_catalog_products product
  join public.product_catalog_import_runs import_run on import_run.id = product.import_run_id
  where import_run.status = 'active'
    and product.search_document @@ websearch_to_tsquery('german'::regconfig, btrim(search_text))
  order by
    ts_rank_cd(product.search_document, websearch_to_tsquery('german'::regconfig, btrim(search_text))) desc,
    product.completeness desc,
    product.name_de nulls last,
    product.name
  limit least(greatest(coalesce(result_limit, 8), 1), 20);
end;
$$;

revoke all on function public.search_global_catalog_products(text, integer) from public, anon;
grant execute on function public.search_global_catalog_products(text, integer) to authenticated;

commit;
