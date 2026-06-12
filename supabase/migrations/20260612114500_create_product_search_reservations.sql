-- Customer product search reservations.
-- Replaces local mock price alerts with persisted user-owned reservations.

create table if not exists public.product_search_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null,
  min_price_usdt numeric(12,4) not null default 0,
  max_price_usdt numeric(12,4),
  notify_telegram boolean not null default false,
  telegram_address text,
  notify_email boolean not null default false,
  email_address text,
  enabled boolean not null default true,
  last_matched_product_id uuid references public.products(id) on delete set null,
  last_matched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_price_usdt >= 0),
  check (max_price_usdt is null or max_price_usdt >= min_price_usdt),
  check (notify_telegram or notify_email)
);

create trigger trg_product_search_reservations_updated_at
before update on public.product_search_reservations
for each row execute function public.idfit_update_updated_at();

alter table public.product_search_reservations enable row level security;

drop policy if exists "customers_manage_own_product_search_reservations" on public.product_search_reservations;
create policy "customers_manage_own_product_search_reservations"
on public.product_search_reservations
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, insert, update, delete on public.product_search_reservations to authenticated;
