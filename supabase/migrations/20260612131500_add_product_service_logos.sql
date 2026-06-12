-- Store display service logo URL on products and expose it to the customer board.

alter table public.products
  add column if not exists service_logo_url text;

update public.products
set service_logo_url = case
  when coalesce(service_name, '') ~* 'chat\s*gpt|openai|gpt' then 'https://cdn.simpleicons.org/openai/10A37F'
  when coalesce(service_name, '') ~* 'claude|anthropic' then 'https://cdn.simpleicons.org/anthropic/D97757'
  when coalesce(service_name, '') ~* 'cursor' then 'https://cdn.simpleicons.org/cursor/FFFFFF'
  when coalesce(service_name, '') ~* 'midjourney|\mmj\M' then 'https://cdn.simpleicons.org/midjourney/FFFFFF'
  when coalesce(service_name, '') ~* 'perplexity' then 'https://cdn.simpleicons.org/perplexity/20808D'
  when coalesce(service_name, '') ~* 'gemini|google\s*ai' then 'https://cdn.simpleicons.org/googlegemini/8E75B2'
  when coalesce(service_name, '') ~* 'suno' then 'https://cdn.simpleicons.org/suno/FFFFFF'
  when coalesce(service_name, '') ~* 'runway' then 'https://cdn.simpleicons.org/runway/FFFFFF'
  when coalesce(service_name, '') ~* 'notion' then 'https://cdn.simpleicons.org/notion/FFFFFF'
  when coalesce(service_name, '') ~* 'canva' then 'https://cdn.simpleicons.org/canva/00C4CC'
  when coalesce(service_name, '') ~* 'cap\s*cut|capcut' then 'https://cdn.simpleicons.org/capcut/FFFFFF'
  when coalesce(service_name, '') ~* 'grok' then 'https://cdn.simpleicons.org/x/FFFFFF'
  when coalesce(service_name, '') ~* 'deep\s*seek|deepseek' then 'https://cdn.simpleicons.org/deepseek/4D6BFF'
  when coalesce(service_name, '') ~* 'adobe' then 'https://cdn.simpleicons.org/adobe/FA0F00'
  when coalesce(service_name, '') ~* 'youtube' then 'https://cdn.simpleicons.org/youtube/FF0000'
  when coalesce(service_name, '') ~* 'netflix' then 'https://cdn.simpleicons.org/netflix/E50914'
  when coalesce(service_name, '') ~* 'gmail' then 'https://cdn.simpleicons.org/gmail/EA4335'
  when coalesce(service_name, '') ~* 'hotmail|outlook' then 'https://cdn.simpleicons.org/microsoftoutlook/0078D4'
  when coalesce(service_name, '') ~* '\mvpn\M|hma' then 'https://cdn.simpleicons.org/protonvpn/6D4AFF'
  when coalesce(service_name, '') ~* 'xbox' then 'https://cdn.simpleicons.org/xbox/107C10'
  else service_logo_url
end
where service_logo_url is null;

create or replace view public.visible_products as
select
  p.id,
  p.service_name,
  p.service_logo_url,
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

grant select on public.visible_products to anon, authenticated;

create or replace view public.board_products as
select
  p.id,
  p.service_name,
  p.service_logo_url,
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

grant select on public.board_products to anon, authenticated;

grant select, insert, update, delete on table public.products to service_role;
