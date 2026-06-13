-- Refresh board product views so the deployed Live Board can read newly collected products.

create or replace view public.visible_products as
select
  p.id,
  p.service_name,
  p.service_logo_url,
  p.title,
  p.description,
  p.sale_price_usdt,
  p.supplier_cost_usdt,
  p.stock_state,
  p.stock_count,
  p.last_synced_at,
  p.updated_at,
  p.metadata,
  coalesce(ts.telegram_identifier, ts.name, p.metadata->>'source', 'verified-source') as source_label,
  coalesce(ts.trust_override, nullif(p.metadata->>'source_trust', '')::numeric, 4.7) as source_trust
from public.products p
left join public.telegram_sources ts on ts.id = p.source_id
where p.status = 'visible'
  and p.stock_state in ('in_stock', 'low');

create or replace view public.board_products as
select
  p.id,
  p.service_name,
  p.service_logo_url,
  p.title,
  p.description,
  p.sale_price_usdt,
  p.supplier_cost_usdt,
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

grant select on public.visible_products to anon, authenticated;
grant select on public.board_products to anon, authenticated;
