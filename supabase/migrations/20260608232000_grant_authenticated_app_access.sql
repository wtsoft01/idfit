-- Grant authenticated app users table access required by RLS policies.
-- RLS policies still restrict rows/actions by user role and ownership.
-- This migration is defensive because older remote DBs may still use dealfinder_profiles.

grant usage on schema public to authenticated;

do $$
begin
  if to_regclass('public.idfit_profiles') is not null then
    grant select, insert, update on table public.idfit_profiles to authenticated;
  end if;
  if to_regclass('public.dealfinder_profiles') is not null then
    grant select, insert, update on table public.dealfinder_profiles to authenticated;
  end if;
end $$;

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
    'supplier_purchase_jobs'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    end if;
  end loop;

  foreach table_name in array array[
    'orders',
    'delivery_items',
    'as_tickets'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('grant select, insert, update on table public.%I to authenticated', table_name);
    end if;
  end loop;
end $$;
