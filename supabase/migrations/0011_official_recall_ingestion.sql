begin;

alter table public.recall_events
  add column superseded_by uuid references public.recall_events(id) on delete restrict;
create index recall_events_current_idx on public.recall_events (source_id, source_record_id, retrieved_at desc)
  where superseded_by is null;

insert into public.recall_sources (
  source_key, display_name, authority_url, approved
) values (
  'de-lebensmittelwarnung-rss',
  'lebensmittelwarnung.de – Portal der Bundesländer und des BVL',
  'https://www.lebensmittelwarnung.de/___LMW-Redaktion/RSSNewsfeed/rssnewsfeed_node.html',
  false
) on conflict (source_key) do update set
  display_name = excluded.display_name,
  authority_url = excluded.authority_url;

create or replace function public.ingest_recall_event(
  target_source_key text,
  source_record_id text,
  payload_sha256 text,
  parser_version text,
  title text,
  product_name text,
  brand text,
  gtins text[],
  lot_numbers text[],
  reason text,
  source_url text,
  published_at timestamptz,
  source_updated_at timestamptz,
  retrieved_at timestamptz,
  raw_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  source_record public.recall_sources%rowtype;
  previous_event public.recall_events%rowtype;
  saved_event_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required';
  end if;
  if payload_sha256 !~ '^[a-f0-9]{64}$'
    or char_length(btrim(source_record_id)) < 1
    or char_length(btrim(parser_version)) < 1
    or char_length(btrim(title)) < 1
    or char_length(btrim(product_name)) < 1
    or source_url !~ '^https://www[.]lebensmittelwarnung[.]de/' then
    raise exception using errcode = '22023', message = 'Invalid recall payload';
  end if;

  select * into source_record
  from public.recall_sources
  where source_key = target_source_key
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'Unknown recall source';
  end if;
  if not source_record.approved or source_record.license_reviewed_at is null then
    raise exception using errcode = '42501', message = 'Recall source approval incomplete';
  end if;

  select * into previous_event
  from public.recall_events event
  where event.source_id = source_record.id
    and event.source_record_id = ingest_recall_event.source_record_id
    and event.superseded_by is null
  order by event.retrieved_at desc
  limit 1
  for update;

  if found and previous_event.payload_sha256 = ingest_recall_event.payload_sha256 then
    update public.recall_sources
    set last_attempt_at = now(), last_success_at = now(), last_error_code = null
    where id = source_record.id;
    return jsonb_build_object('event_id', previous_event.id, 'idempotent_replay', true, 'corrected', false);
  end if;

  insert into public.recall_events (
    source_id, source_record_id, payload_sha256, parser_version, status, title,
    product_name, brand, gtins, lot_numbers, reason, source_url, published_at,
    source_updated_at, retrieved_at, raw_payload
  ) values (
    source_record.id, btrim(source_record_id), payload_sha256, btrim(parser_version),
    'active', btrim(title), btrim(product_name), nullif(btrim(brand), ''),
    coalesce(gtins, '{}'), coalesce(lot_numbers, '{}'), nullif(btrim(reason), ''),
    source_url, published_at, source_updated_at, retrieved_at, raw_payload
  ) returning id into saved_event_id;

  if previous_event.id is not null then
    update public.recall_events
    set status = 'corrected', superseded_by = saved_event_id
    where id = previous_event.id;
  end if;

  update public.recall_sources
  set last_attempt_at = now(), last_success_at = now(), last_error_code = null
  where id = source_record.id;

  return jsonb_build_object(
    'event_id', saved_event_id,
    'idempotent_replay', false,
    'corrected', previous_event.id is not null
  );
end;
$$;

create or replace function public.batch_has_exact_recall(target_batch uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.inventory_batches batch
    join public.products product on product.id = batch.product_id
    join public.recall_events event on product.gtin = any(event.gtins)
    join public.recall_sources source on source.id = event.source_id and source.approved
    where batch.id = target_batch
      and event.status in ('active', 'corrected')
      and event.superseded_by is null
      and batch.lot_number is not null
      and exists (
        select 1
        from unnest(event.lot_numbers) lot
        where public.canonical_food_key(lot) = public.canonical_food_key(batch.lot_number)
      )
  );
$$;

revoke all on function public.ingest_recall_event(text, text, text, text, text, text, text, text[], text[], text, text, timestamptz, timestamptz, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_recall_event(text, text, text, text, text, text, text, text[], text[], text, text, timestamptz, timestamptz, timestamptz, jsonb) to service_role;
revoke all on function public.batch_has_exact_recall(uuid) from public, anon, authenticated;

commit;
