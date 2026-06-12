-- Require an authenticated app user for visible product catalog reads.
-- Public landing should show locked previews only; live product data is available after login.

drop policy if exists "public_select_visible_products" on public.products;

create policy "authenticated_select_visible_products"
on public.products
for select
to authenticated
using (status = 'visible' and stock_state in ('in_stock','low'));
