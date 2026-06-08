-- Allow backend collectors that authenticate with the Supabase service role to ingest data.
-- RLS is still enabled for browser clients; this only grants REST access for server-only service role keys.

create policy "service_role_manage_sources"
  on public.telegram_sources
  for all
  to service_role
  using (true)
  with check (true);

create policy "service_role_manage_sellers"
  on public.sellers
  for all
  to service_role
  using (true)
  with check (true);

create policy "service_role_manage_raw_messages"
  on public.raw_messages
  for all
  to service_role
  using (true)
  with check (true);

create policy "service_role_manage_candidates"
  on public.product_candidates
  for all
  to service_role
  using (true)
  with check (true);

create policy "service_role_manage_products"
  on public.products
  for all
  to service_role
  using (true)
  with check (true);

create policy "service_role_manage_purchase_jobs"
  on public.supplier_purchase_jobs
  for all
  to service_role
  using (true)
  with check (true);
