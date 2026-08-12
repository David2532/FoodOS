begin;

-- Generated tsvector values are not reliably populated in a BEFORE UPDATE
-- trigger. They are excluded from the canonical row hash already, so exclude
-- them from the hash-only mutation comparison as well.
create or replace function public.guard_product_catalog_seal_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_run public.product_catalog_import_runs%rowtype;
  target_import_run_id uuid := coalesce(new.import_run_id, old.import_run_id);
begin
  select * into target_run
  from public.product_catalog_import_runs
  where id = target_import_run_id
  for key share;

  if not found then
    raise exception using errcode = 'P0002', message = 'Catalog import run not found';
  end if;

  if tg_op = 'INSERT' then
    if target_run.status is distinct from 'staging' or target_run.seal_cursor_gtin is not null then
      raise exception using errcode = '22023', message = 'Catalog import run is sealed';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if target_run.status is distinct from 'staging' or target_run.seal_cursor_gtin is not null then
      raise exception using errcode = '22023', message = 'Catalog import run is sealed';
    end if;
    return old;
  end if;

  if new.import_run_id is distinct from old.import_run_id
    or target_run.status is distinct from 'staging' then
    raise exception using errcode = '22023', message = 'Catalog import run is sealed';
  end if;

  if target_run.seal_cursor_gtin is null then
    return new;
  end if;

  if (to_jsonb(new) - array['normalized_content_sha256', 'search_document'])
      is not distinct from (to_jsonb(old) - array['normalized_content_sha256', 'search_document'])
    and new.normalized_content_sha256 = public.product_catalog_row_hash(old) then
    return new;
  end if;

  raise exception using errcode = '22023', message = 'Catalog product is sealed';
end;
$$;

revoke all on function public.guard_product_catalog_seal_state() from public, anon, authenticated;

commit;
