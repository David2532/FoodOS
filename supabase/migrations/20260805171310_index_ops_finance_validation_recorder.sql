begin;

-- Cover the auth.users foreign key used during account deletion/restriction checks.
create index ops_finance_source_validation_recorded_by_idx
  on public.ops_finance_source_validation_events (recorded_by);

commit;
