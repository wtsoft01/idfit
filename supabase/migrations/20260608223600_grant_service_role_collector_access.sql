-- Grant PostgREST table access to service_role for backend collectors and ingestion scripts.
-- RLS policies still determine row access; these grants allow the service role to reach the tables.

grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.telegram_sources,
  public.sellers,
  public.raw_messages,
  public.margin_rules,
  public.product_candidates,
  public.products,
  public.supplier_purchase_jobs
  to service_role;

grant select, insert, update, delete on table
  public.orders,
  public.delivery_items,
  public.as_tickets
  to service_role;

grant select, insert, update, delete on table
  public.dealfinder_profiles
  to service_role;
