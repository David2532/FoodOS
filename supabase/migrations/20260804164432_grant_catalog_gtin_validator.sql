begin;

-- This immutable checksum validator reads no tables or session state. It is safe
-- for public barcode-format validation and remains separate from every protected
-- catalog or household RPC.
grant execute on function public.is_valid_catalog_gtin(text) to public;

commit;
