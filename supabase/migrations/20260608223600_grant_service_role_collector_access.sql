-- Grant PostgREST table access to service_role for backend collectors and ingestion scripts.
-- RLS policies still determine row access; these grants allow the service role to reach the tables.
-- This migration is defensive because older remote DBs may still use dealfinder_profiles.

grant usage on schema public to service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'telegram_sources',
    'sellers',
    'raw_messages',
    'margin_rules',
    'product_candidates',
    'products',
    'supplier_purchase_jobs',
    'orders',
    'delivery_items',
    'as_tickets',
    'idfit_profiles',
    'dealfinder_profiles'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('grant select, insert, update, delete on table public.%I to service_role', table_name);
    end if;
  end loop;
end $$;
