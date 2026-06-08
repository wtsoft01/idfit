-- Public customer product catalog for IDFIT.
-- Exposes only safe, sale-facing product fields instead of opening the full products/sources tables.

create or replace view public.visible_products as
select
  p.id,
  p.service_name,
  p.title,
  p.description,
  p.sale_price_usdt,
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

grant usage on schema public to anon, authenticated;
grant select on public.visible_products to anon, authenticated;

insert into public.telegram_sources (name, source_type, telegram_identifier, status, trust_override, auto_collect_enabled, metadata)
values
  ('GPT Market KR', 'channel', '@gpt_market_kr', 'live', 4.80, true, '{"seed": true}'::jsonb),
  ('Claude Market', 'channel', '@claude_market', 'live', 4.70, true, '{"seed": true}'::jsonb),
  ('Cursor Keys TR', 'channel', '@cursor_keys_tr', 'live', 4.80, true, '{"seed": true}'::jsonb),
  ('AI Deals Global', 'channel', '@ai_deals_global', 'live', 4.60, true, '{"seed": true}'::jsonb),
  ('Subs Resell ID', 'channel', '@subs_resell_id', 'live', 4.90, true, '{"seed": true}'::jsonb)
on conflict (source_type, telegram_identifier) do update set
  name = excluded.name,
  status = excluded.status,
  trust_override = excluded.trust_override,
  auto_collect_enabled = excluded.auto_collect_enabled,
  updated_at = now();

with source_map as (
  select id, telegram_identifier from public.telegram_sources
  where telegram_identifier in ('@gpt_market_kr', '@claude_market', '@cursor_keys_tr', '@ai_deals_global', '@subs_resell_id')
), seed_products(service_name, title, description, supplier_cost_usdt, sale_price_usdt, stock_state, stock_count, source_identifier, warranty_days) as (
  values
    ('ChatGPT Plus', 'ChatGPT Plus · 30일 · 1인 공유 · 즉시 로그인', '검증된 소스에서 확인한 ChatGPT Plus 30일 상품입니다.', 10.5000, 13.9000, 'in_stock'::public.stock_state, 24, '@gpt_market_kr', 30),
    ('ChatGPT Plus', 'ChatGPT Plus · 90일 · 1인 전용', '90일 보장형 ChatGPT Plus 전용 계정 상품입니다.', 29.0000, 36.5000, 'in_stock'::public.stock_state, 9, '@gpt_market_kr', 90),
    ('ChatGPT Pro', 'ChatGPT Pro · 30일 · 고급 플랜', '고가 플랜은 운영자 확인 후 전달됩니다.', 102.0000, 128.0000, 'low'::public.stock_state, 4, '@ai_deals_global', 30),
    ('Claude Pro', 'Claude Pro · 30일 · 1인 공유', 'Claude Pro 30일 보장 상품입니다.', 12.0000, 15.2000, 'in_stock'::public.stock_state, 17, '@claude_market', 30),
    ('Claude Max', 'Claude Max · 30일 · Sonnet+Opus 풀팩', 'Claude Max 고급 플랜 상품입니다.', 62.0000, 78.0000, 'low'::public.stock_state, 6, '@claude_market', 30),
    ('Cursor Pro', 'Cursor Pro · 90일 · 팀시트 5인', '개발자용 Cursor Pro 팀시트 상품입니다.', 30.0000, 38.0000, 'in_stock'::public.stock_state, 11, '@cursor_keys_tr', 90),
    ('Cursor Pro', 'Cursor Pro · 30일 · 1인', 'Cursor Pro 30일 개인용 상품입니다.', 9.5000, 12.4000, 'in_stock'::public.stock_state, 21, '@ai_deals_global', 30),
    ('Perplexity Pro', 'Perplexity Pro · 365일 · 코드 / 이메일 즉시 발급', '장기형 Perplexity Pro 코드 상품입니다.', 4.5000, 6.9000, 'in_stock'::public.stock_state, 48, '@subs_resell_id', 365)
)
insert into public.products (
  service_name,
  title,
  description,
  supplier_cost_usdt,
  sale_price_usdt,
  margin_usdt,
  margin_rate,
  stock_state,
  stock_count,
  source_id,
  status,
  last_synced_at,
  metadata
)
select
  sp.service_name,
  sp.title,
  sp.description,
  sp.supplier_cost_usdt,
  sp.sale_price_usdt,
  sp.sale_price_usdt - sp.supplier_cost_usdt,
  round(((sp.sale_price_usdt - sp.supplier_cost_usdt) / nullif(sp.supplier_cost_usdt, 0)) * 100, 4),
  sp.stock_state,
  sp.stock_count,
  sm.id,
  'visible'::public.product_status,
  now(),
  jsonb_build_object('seed', true, 'warranty_days', sp.warranty_days, 'source', sp.source_identifier)
from seed_products sp
left join source_map sm on sm.telegram_identifier = sp.source_identifier
where not exists (
  select 1 from public.products existing
  where existing.title = sp.title
);
