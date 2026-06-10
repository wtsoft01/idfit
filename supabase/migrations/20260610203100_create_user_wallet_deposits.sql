-- Customer deposit wallet and refund address support for IDFIT.

create table if not exists public.user_wallet_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  balance_usdt numeric(12,4) not null default 0,
  locked_usdt numeric(12,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (balance_usdt >= 0),
  check (locked_usdt >= 0)
);

create table if not exists public.user_refund_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset text not null default 'USDT',
  network text not null default 'TRC20',
  address text not null,
  label text not null default '환불 지갑',
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, asset, network)
);

create table if not exists public.user_deposit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset text not null default 'USDT',
  network text not null default 'TRC20',
  amount_usdt numeric(12,4) not null,
  payment_address text not null,
  status text not null default 'pending',
  payment_tx_hash text,
  customer_note text,
  admin_note text,
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_usdt > 0),
  check (status in ('pending','confirmed','expired','rejected'))
);

create table if not exists public.user_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deposit_request_id uuid references public.user_deposit_requests(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  kind text not null,
  amount_usdt numeric(12,4) not null,
  status text not null default 'confirmed',
  memo text,
  created_at timestamptz not null default now(),
  check (kind in ('deposit','purchase','refund','adjustment')),
  check (status in ('pending','confirmed','rejected'))
);

create or replace function public.idfit_ensure_wallet_account(_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  account_id uuid;
begin
  insert into public.user_wallet_accounts (user_id)
  values (_user_id)
  on conflict (user_id) do nothing;

  select id into account_id
  from public.user_wallet_accounts
  where user_id = _user_id;

  return account_id;
end;
$$;

create or replace function public.idfit_ensure_wallet_account_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.idfit_ensure_wallet_account(new.user_id);
  return new;
end;
$$;

create or replace function public.idfit_apply_confirmed_deposit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'confirmed' and (old.status is null or old.status <> 'confirmed') then
    perform public.idfit_ensure_wallet_account(new.user_id);

    update public.user_wallet_accounts
    set balance_usdt = balance_usdt + new.amount_usdt,
        updated_at = now()
    where user_id = new.user_id;

    insert into public.user_wallet_ledger (user_id, deposit_request_id, kind, amount_usdt, status, memo)
    values (new.user_id, new.id, 'deposit', new.amount_usdt, 'confirmed', '예치금 충전 확인')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists user_wallet_accounts_updated_at on public.user_wallet_accounts;
drop trigger if exists user_refund_wallets_updated_at on public.user_refund_wallets;
drop trigger if exists user_deposit_requests_updated_at on public.user_deposit_requests;
drop trigger if exists user_refund_wallets_ensure_account on public.user_refund_wallets;
drop trigger if exists user_deposit_requests_ensure_account on public.user_deposit_requests;
drop trigger if exists user_deposit_requests_apply_confirmed on public.user_deposit_requests;

create trigger user_wallet_accounts_updated_at before update on public.user_wallet_accounts for each row execute function public.idfit_update_updated_at();
create trigger user_refund_wallets_updated_at before update on public.user_refund_wallets for each row execute function public.idfit_update_updated_at();
create trigger user_deposit_requests_updated_at before update on public.user_deposit_requests for each row execute function public.idfit_update_updated_at();
create trigger user_refund_wallets_ensure_account before insert on public.user_refund_wallets for each row execute function public.idfit_ensure_wallet_account_trigger();
create trigger user_deposit_requests_ensure_account before insert on public.user_deposit_requests for each row execute function public.idfit_ensure_wallet_account_trigger();
create trigger user_deposit_requests_apply_confirmed after update on public.user_deposit_requests for each row execute function public.idfit_apply_confirmed_deposit();

alter table public.user_wallet_accounts enable row level security;
alter table public.user_refund_wallets enable row level security;
alter table public.user_deposit_requests enable row level security;
alter table public.user_wallet_ledger enable row level security;

drop policy if exists "customers_select_own_wallet_accounts" on public.user_wallet_accounts;
drop policy if exists "staff_manage_wallet_accounts" on public.user_wallet_accounts;
drop policy if exists "customers_manage_own_refund_wallets" on public.user_refund_wallets;
drop policy if exists "staff_manage_refund_wallets" on public.user_refund_wallets;
drop policy if exists "customers_select_own_deposit_requests" on public.user_deposit_requests;
drop policy if exists "customers_insert_own_deposit_requests" on public.user_deposit_requests;
drop policy if exists "customers_update_own_pending_deposit_requests" on public.user_deposit_requests;
drop policy if exists "staff_manage_deposit_requests" on public.user_deposit_requests;
drop policy if exists "customers_select_own_wallet_ledger" on public.user_wallet_ledger;
drop policy if exists "staff_manage_wallet_ledger" on public.user_wallet_ledger;

create policy "customers_select_own_wallet_accounts" on public.user_wallet_accounts
  for select to authenticated
  using (user_id = auth.uid() or public.idfit_has_role(auth.uid(), array['owner','admin','operator','support']::public.idfit_app_role[]));

create policy "staff_manage_wallet_accounts" on public.user_wallet_accounts
  for all to authenticated
  using (public.idfit_has_role(auth.uid(), array['owner','admin','operator']::public.idfit_app_role[]))
  with check (public.idfit_has_role(auth.uid(), array['owner','admin','operator']::public.idfit_app_role[]));

create policy "customers_manage_own_refund_wallets" on public.user_refund_wallets
  for all to authenticated
  using (user_id = auth.uid() or public.idfit_has_role(auth.uid(), array['owner','admin','operator','support']::public.idfit_app_role[]))
  with check (user_id = auth.uid() or public.idfit_has_role(auth.uid(), array['owner','admin','operator','support']::public.idfit_app_role[]));

create policy "customers_select_own_deposit_requests" on public.user_deposit_requests
  for select to authenticated
  using (user_id = auth.uid() or public.idfit_has_role(auth.uid(), array['owner','admin','operator','support']::public.idfit_app_role[]));

create policy "customers_insert_own_deposit_requests" on public.user_deposit_requests
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

create policy "customers_update_own_pending_deposit_requests" on public.user_deposit_requests
  for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'pending');

create policy "staff_manage_deposit_requests" on public.user_deposit_requests
  for all to authenticated
  using (public.idfit_has_role(auth.uid(), array['owner','admin','operator','support']::public.idfit_app_role[]))
  with check (public.idfit_has_role(auth.uid(), array['owner','admin','operator','support']::public.idfit_app_role[]));

create policy "customers_select_own_wallet_ledger" on public.user_wallet_ledger
  for select to authenticated
  using (user_id = auth.uid() or public.idfit_has_role(auth.uid(), array['owner','admin','operator','support']::public.idfit_app_role[]));

create policy "staff_manage_wallet_ledger" on public.user_wallet_ledger
  for all to authenticated
  using (public.idfit_has_role(auth.uid(), array['owner','admin','operator']::public.idfit_app_role[]))
  with check (public.idfit_has_role(auth.uid(), array['owner','admin','operator']::public.idfit_app_role[]));

grant select on table public.user_wallet_accounts to authenticated;
grant select, insert, update, delete on table public.user_refund_wallets to authenticated;
grant select, insert, update on table public.user_deposit_requests to authenticated;
grant select on table public.user_wallet_ledger to authenticated;
grant select, insert, update, delete on table public.user_wallet_accounts to service_role;
grant select, insert, update, delete on table public.user_refund_wallets to service_role;
grant select, insert, update, delete on table public.user_deposit_requests to service_role;
grant select, insert, update, delete on table public.user_wallet_ledger to service_role;

create index if not exists idx_user_wallet_accounts_user_id on public.user_wallet_accounts(user_id);
create index if not exists idx_user_refund_wallets_user_id on public.user_refund_wallets(user_id);
create index if not exists idx_user_deposit_requests_user_created on public.user_deposit_requests(user_id, created_at desc);
create index if not exists idx_user_deposit_requests_status on public.user_deposit_requests(status, created_at desc);
create index if not exists idx_user_wallet_ledger_user_created on public.user_wallet_ledger(user_id, created_at desc);
