-- Grant authenticated app users table access required by RLS policies.
-- RLS policies still restrict rows/actions by user role and ownership.

grant usage on schema public to authenticated;

grant select, insert, update on table public.dealfinder_profiles to authenticated;

grant select, insert, update, delete on table
  public.telegram_sources,
  public.sellers,
  public.raw_messages,
  public.margin_rules,
  public.product_candidates,
  public.products,
  public.supplier_purchase_jobs
  to authenticated;

grant select, insert, update on table
  public.orders,
  public.delivery_items,
  public.as_tickets
  to authenticated;
