-- IDFIT core schema
-- Focus: Telegram data collection + USDT sales management

create extension if not exists pgcrypto;

create type public.dealfinder_app_role as enum ('owner', 'admin', 'operator', 'support', 'customer');
create type public.telegram_source_type as enum ('group', 'channel', 'bot', 'manual');
create type public.source_status as enum ('live', 'paused', 'throttled', 'blocked');
create type public.raw_message_parse_status as enum ('pending', 'parsed', 'ignored', 'failed');
create type public.stock_state as enum ('in_stock', 'low', 'sold_out', 'unknown');
create type public.delivery_type as enum ('code', 'login', 'invite_link', 'manual');
create type public.candidate_status as enum ('candidate', 'approved', 'hidden', 'expired', 'rejected');
create type public.product_status as enum ('visible', 'hidden', 'sold_out', 'expired');
create type public.margin_scope as enum ('global', 'service', 'source', 'seller');
create type public.margin_type as enum ('percent', 'fixed_usdt', 'percent_plus_fixed');
create type public.order_status as enum ('payment_pending', 'payment_confirmed', 'purchasing', 'delivered', 'as_open', 'failed', 'refunded_review');
create type public.purchase_job_status as enum ('queued', 'checking_stock', 'purchasing', 'waiting_payment', 'waiting_delivery', 'delivered', 'manual_review', 'failed');
create type public.as_ticket_status as enum ('open', 'investigating', 'replacement_sent', 'rejected', 'closed');
create type public.as_issue_type as enum ('invalid_login', 'used_code', 'expired', 'wrong_product', 'other');

create table if not exists public.dealfinder_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.dealfinder_app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.telegram_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type public.telegram_source_type not null,
  telegram_identifier text not null,
  status public.source_status not null default 'paused',
  trust_override numeric(5,2),
  auto_collect_enabled boolean not null default false,
  auto_purchase_enabled boolean not null default false,
  default_margin_rule_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, telegram_identifier)
);

create table if not exists public.sellers (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.telegram_sources(id) on delete cascade,
  display_name text not null default '',
  telegram_identifier text,
  trust_score numeric(5,2) not null default 50,
  observed_sales_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  as_count integer not null default 0,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, telegram_identifier)
);

create table if not exists public.raw_messages (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.telegram_sources(id) on delete cascade,
  telegram_message_id text,
  sender_identifier text,
  message_text text not null default '',
  message_media jsonb not null default '[]'::jsonb,
  original_url text,
  received_at timestamptz not null default now(),
  parse_status public.raw_message_parse_status not null default 'pending',
  parser_version text,
  hash_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_id, hash_key)
);

create table if not exists public.margin_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope public.margin_scope not null default 'global',
  scope_value text,
  margin_type public.margin_type not null default 'percent',
  percent_value numeric(8,4) not null default 20,
  fixed_usdt numeric(12,4) not null default 0,
  min_margin_usdt numeric(12,4) not null default 0,
  max_price_usdt numeric(12,4),
  enabled boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_candidates (
  id uuid primary key default gen_random_uuid(),
  raw_message_id uuid not null references public.raw_messages(id) on delete cascade,
  source_id uuid not null references public.telegram_sources(id) on delete cascade,
  seller_id uuid references public.sellers(id) on delete set null,
  service_name text not null default '',
  product_title text not null,
  duration_days integer,
  supplier_cost_usdt numeric(12,4),
  supplier_currency text not null default 'USDT',
  stock_state public.stock_state not null default 'unknown',
  stock_count integer,
  delivery_type public.delivery_type not null default 'manual',
  parsed_confidence numeric(5,2) not null default 0,
  freshness_expires_at timestamptz,
  status public.candidate_status not null default 'candidate',
  admin_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.product_candidates(id) on delete set null,
  service_name text not null default '',
  title text not null,
  description text not null default '',
  supplier_cost_usdt numeric(12,4) not null default 0,
  sale_price_usdt numeric(12,4) not null default 0,
  margin_usdt numeric(12,4) not null default 0,
  margin_rate numeric(8,4) not null default 0,
  stock_state public.stock_state not null default 'unknown',
  stock_count integer,
  source_id uuid references public.telegram_sources(id) on delete set null,
  seller_id uuid references public.sellers(id) on delete set null,
  status public.product_status not null default 'hidden',
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sale_price_usdt >= 0),
  check (supplier_cost_usdt >= 0)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  user_id uuid not null references auth.users(id),
  product_id uuid not null references public.products(id),
  status public.order_status not null default 'payment_pending',
  sale_price_usdt numeric(12,4) not null,
  supplier_cost_usdt numeric(12,4) not null default 0,
  margin_usdt numeric(12,4) not null default 0,
  payment_network text not null default 'TRC20',
  payment_address text,
  payment_tx_hash text,
  payment_confirmed_at timestamptz,
  customer_note text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sale_price_usdt >= 0)
);

create table if not exists public.supplier_purchase_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  source_id uuid references public.telegram_sources(id) on delete set null,
  seller_id uuid references public.sellers(id) on delete set null,
  status public.purchase_job_status not null default 'queued',
  expected_cost_usdt numeric(12,4),
  actual_cost_usdt numeric(12,4),
  max_allowed_cost_usdt numeric(12,4),
  conversation_log jsonb not null default '[]'::jsonb,
  failure_reason text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  delivery_type public.delivery_type not null,
  encrypted_payload text not null,
  visible_to_customer boolean not null default false,
  delivered_at timestamptz,
  replaced_by_id uuid references public.delivery_items(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.as_tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  status public.as_ticket_status not null default 'open',
  issue_type public.as_issue_type not null default 'other',
  customer_message text not null default '',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.dealfinder_update_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.dealfinder_has_role(_user_id uuid, _roles public.dealfinder_app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.dealfinder_profiles
    where user_id = _user_id
      and role = any(_roles)
  );
$$;

create or replace function public.dealfinder_next_order_no()
returns text
language plpgsql
set search_path = public
as $$
begin
  return 'DF-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
end;
$$;

create or replace function public.dealfinder_set_order_no()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.order_no is null or new.order_no = '' then
    new.order_no = public.dealfinder_next_order_no();
  end if;
  return new;
end;
$$;

create or replace function public.dealfinder_calculate_sale_price(
  supplier_cost numeric,
  margin_type public.margin_type,
  percent_value numeric,
  fixed_usdt numeric,
  min_margin_usdt numeric,
  max_price_usdt numeric
)
returns numeric
language plpgsql
immutable
as $$
declare
  calculated_margin numeric := 0;
  calculated_price numeric := 0;
begin
  if supplier_cost is null then
    return 0;
  end if;

  if margin_type = 'percent' then
    calculated_margin := supplier_cost * coalesce(percent_value, 0) / 100;
  elsif margin_type = 'fixed_usdt' then
    calculated_margin := coalesce(fixed_usdt, 0);
  else
    calculated_margin := supplier_cost * coalesce(percent_value, 0) / 100 + coalesce(fixed_usdt, 0);
  end if;

  calculated_margin := greatest(calculated_margin, coalesce(min_margin_usdt, 0));
  calculated_price := supplier_cost + calculated_margin;

  if max_price_usdt is not null then
    calculated_price := least(calculated_price, max_price_usdt);
  end if;

  return round(calculated_price, 4);
end;
$$;

create trigger dealfinder_profiles_updated_at before update on public.dealfinder_profiles for each row execute function public.dealfinder_update_updated_at();
create trigger telegram_sources_updated_at before update on public.telegram_sources for each row execute function public.dealfinder_update_updated_at();
create trigger sellers_updated_at before update on public.sellers for each row execute function public.dealfinder_update_updated_at();
create trigger margin_rules_updated_at before update on public.margin_rules for each row execute function public.dealfinder_update_updated_at();
create trigger product_candidates_updated_at before update on public.product_candidates for each row execute function public.dealfinder_update_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.dealfinder_update_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.dealfinder_update_updated_at();
create trigger supplier_purchase_jobs_updated_at before update on public.supplier_purchase_jobs for each row execute function public.dealfinder_update_updated_at();
create trigger delivery_items_updated_at before update on public.delivery_items for each row execute function public.dealfinder_update_updated_at();
create trigger as_tickets_updated_at before update on public.as_tickets for each row execute function public.dealfinder_update_updated_at();
create trigger orders_set_order_no before insert on public.orders for each row execute function public.dealfinder_set_order_no();

alter table public.dealfinder_profiles enable row level security;
alter table public.telegram_sources enable row level security;
alter table public.sellers enable row level security;
alter table public.raw_messages enable row level security;
alter table public.margin_rules enable row level security;
alter table public.product_candidates enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.supplier_purchase_jobs enable row level security;
alter table public.delivery_items enable row level security;
alter table public.as_tickets enable row level security;

create policy "profiles_select_own_or_staff" on public.dealfinder_profiles for select to authenticated using (user_id = auth.uid() or public.dealfinder_has_role(auth.uid(), array['owner','admin','operator','support']::public.dealfinder_app_role[]));
create policy "profiles_update_own" on public.dealfinder_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "staff_manage_sources" on public.telegram_sources for all to authenticated using (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator']::public.dealfinder_app_role[])) with check (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator']::public.dealfinder_app_role[]));
create policy "staff_manage_sellers" on public.sellers for all to authenticated using (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator','support']::public.dealfinder_app_role[])) with check (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator']::public.dealfinder_app_role[]));
create policy "staff_manage_raw_messages" on public.raw_messages for all to authenticated using (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator']::public.dealfinder_app_role[])) with check (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator']::public.dealfinder_app_role[]));
create policy "staff_manage_margin_rules" on public.margin_rules for all to authenticated using (public.dealfinder_has_role(auth.uid(), array['owner','admin']::public.dealfinder_app_role[])) with check (public.dealfinder_has_role(auth.uid(), array['owner','admin']::public.dealfinder_app_role[]));
create policy "staff_manage_candidates" on public.product_candidates for all to authenticated using (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator']::public.dealfinder_app_role[])) with check (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator']::public.dealfinder_app_role[]));

create policy "public_select_visible_products" on public.products for select to anon, authenticated using (status = 'visible' and stock_state in ('in_stock','low'));
create policy "staff_manage_products" on public.products for all to authenticated using (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator']::public.dealfinder_app_role[])) with check (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator']::public.dealfinder_app_role[]));

create policy "customers_select_own_orders" on public.orders for select to authenticated using (user_id = auth.uid() or public.dealfinder_has_role(auth.uid(), array['owner','admin','operator','support']::public.dealfinder_app_role[]));
create policy "customers_insert_own_orders" on public.orders for insert to authenticated with check (user_id = auth.uid());
create policy "staff_update_orders" on public.orders for update to authenticated using (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator','support']::public.dealfinder_app_role[])) with check (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator','support']::public.dealfinder_app_role[]));

create policy "staff_manage_purchase_jobs" on public.supplier_purchase_jobs for all to authenticated using (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator','support']::public.dealfinder_app_role[])) with check (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator']::public.dealfinder_app_role[]));

create policy "customers_select_visible_delivery" on public.delivery_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid() and visible_to_customer = true) or public.dealfinder_has_role(auth.uid(), array['owner','admin','operator','support']::public.dealfinder_app_role[]));
create policy "staff_manage_delivery" on public.delivery_items for all to authenticated using (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator','support']::public.dealfinder_app_role[])) with check (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator','support']::public.dealfinder_app_role[]));

create policy "customers_manage_own_as_tickets" on public.as_tickets for select to authenticated using (user_id = auth.uid() or public.dealfinder_has_role(auth.uid(), array['owner','admin','operator','support']::public.dealfinder_app_role[]));
create policy "customers_insert_own_as_tickets" on public.as_tickets for insert to authenticated with check (user_id = auth.uid());
create policy "staff_update_as_tickets" on public.as_tickets for update to authenticated using (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator','support']::public.dealfinder_app_role[])) with check (public.dealfinder_has_role(auth.uid(), array['owner','admin','operator','support']::public.dealfinder_app_role[]));

create index if not exists idx_dealfinder_profiles_user_id on public.dealfinder_profiles(user_id);
create index if not exists idx_telegram_sources_status on public.telegram_sources(status);
create index if not exists idx_sellers_source_id on public.sellers(source_id);
create index if not exists idx_raw_messages_source_received on public.raw_messages(source_id, received_at desc);
create index if not exists idx_raw_messages_parse_status on public.raw_messages(parse_status);
create index if not exists idx_product_candidates_status on public.product_candidates(status);
create index if not exists idx_product_candidates_source_id on public.product_candidates(source_id);
create index if not exists idx_products_status_stock on public.products(status, stock_state);
create index if not exists idx_orders_user_id_created on public.orders(user_id, created_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_purchase_jobs_status on public.supplier_purchase_jobs(status);
create index if not exists idx_delivery_items_order_id on public.delivery_items(order_id);
create index if not exists idx_as_tickets_order_id on public.as_tickets(order_id);

insert into public.margin_rules (name, scope, margin_type, percent_value, fixed_usdt, min_margin_usdt, enabled)
values ('Default 20% margin', 'global', 'percent', 20, 0, 1, true)
on conflict do nothing;


