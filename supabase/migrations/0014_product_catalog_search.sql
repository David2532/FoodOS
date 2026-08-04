alter table public.products
  add column if not exists search_document tsvector
  generated always as (
    to_tsvector(
      'german'::regconfig,
      coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(gtin, '')
    )
  ) stored;

create index if not exists products_search_document_idx
  on public.products using gin (search_document);

create or replace function public.search_cached_products(search_text text, result_limit integer default 8)
returns table (
  barcode text,
  name text,
  brand text,
  image_url text,
  quantity text,
  nutri_score text,
  confidence numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_aal2() then
    raise exception using errcode = '42501', message = 'AAL2 required';
  end if;
  if char_length(btrim(search_text)) < 2 or char_length(search_text) > 80 then
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
    product.data_confidence
  from public.products product
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
