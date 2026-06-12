-- Public sale-facing catalog including ended products for the customer board.
-- Keeps supplier/private fields hidden while allowing the board to show sold-out/expired tabs.

create or replace view public.board_products as
select
  p.id,
  p.service_name,
  p.title,
  p.description,
  p.sale_price_usdt,
  p.stock_state,
  p.stock_count,
  p.status,
  p.last_synced_at,
  p.created_at,
  p.updated_at,
  p.metadata,
  coalesce(ts.telegram_identifier, ts.name, p.metadata->>'source', 'verified-source') as source_label,
  coalesce(ts.trust_override, nullif(p.metadata->>'source_trust', '')::numeric, 4.7) as source_trust
from public.products p
left join public.telegram_sources ts on ts.id = p.source_id
where p.status in ('visible', 'sold_out', 'expired')
  and p.candidate_id is not null;

grant usage on schema public to anon, authenticated;
grant select on public.board_products to anon, authenticated;

create or replace function public.idfit_mark_depleted_products_sold_out()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.products
  set
    status = 'sold_out',
    stock_state = 'sold_out',
    updated_at = now()
  where status = 'visible'
    and (stock_state = 'sold_out' or coalesce(stock_count, 1) <= 0);

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

grant execute on function public.idfit_mark_depleted_products_sold_out() to authenticated;
