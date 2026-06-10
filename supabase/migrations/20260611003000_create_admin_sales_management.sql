-- Add admin account registry and sales referral/commission management.

create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null default '',
  role public.idfit_app_role not null default 'operator',
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  last_login_at timestamptz,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role in ('owner', 'admin', 'operator', 'support'))
);

create table if not exists public.sales_team_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  email text unique,
  phone text,
  user_id uuid references auth.users(id) on delete set null,
  commission_percent numeric(5,2) not null default 10,
  status text not null default 'active' check (status in ('active', 'paused', 'suspended')),
  memo text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code ~ '^[A-Z0-9]{5}$'),
  check (commission_percent >= 0 and commission_percent <= 100)
);

alter table public.idfit_profiles add column if not exists referral_code text references public.sales_team_codes(code) on delete set null;
alter table public.idfit_profiles add column if not exists email text;

alter table public.orders add column if not exists referral_code text references public.sales_team_codes(code) on delete set null;
alter table public.orders add column if not exists sales_code_id uuid references public.sales_team_codes(id) on delete set null;
alter table public.orders add column if not exists commission_percent numeric(5,2) not null default 0;
alter table public.orders add column if not exists commission_usdt numeric(12,4) not null default 0;

create or replace function public.idfit_calculate_order_margin_commission()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  resolved_code text;
  sales_code public.sales_team_codes%rowtype;
  net_profit numeric(12,4);
begin
  new.margin_usdt = greatest(coalesce(new.sale_price_usdt, 0) - coalesce(new.supplier_cost_usdt, 0), 0);
  resolved_code = nullif(upper(coalesce(new.referral_code, '')), '');

  if resolved_code is null then
    select profile.referral_code into resolved_code
    from public.idfit_profiles profile
    where profile.user_id = new.user_id;
  end if;

  if resolved_code is not null then
    select * into sales_code
    from public.sales_team_codes
    where code = resolved_code and status = 'active'
    limit 1;

    if sales_code.id is not null then
      new.referral_code = sales_code.code;
      new.sales_code_id = sales_code.id;
      new.commission_percent = sales_code.commission_percent;
    end if;
  end if;

  net_profit = greatest(coalesce(new.sale_price_usdt, 0) - coalesce(new.supplier_cost_usdt, 0), 0);
  new.commission_usdt = round(net_profit * coalesce(new.commission_percent, 0) / 100, 4);

  return new;
end;
$$;

drop trigger if exists orders_calculate_order_margin_commission on public.orders;
create trigger orders_calculate_order_margin_commission
before insert or update of sale_price_usdt, supplier_cost_usdt, referral_code, user_id, commission_percent
on public.orders
for each row execute function public.idfit_calculate_order_margin_commission();

create or replace function public.idfit_sync_profile_admin_sales()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sales_record public.sales_team_codes%rowtype;
  admin_record public.admin_accounts%rowtype;
begin
  select * into sales_record from public.sales_team_codes where lower(email) = lower(new.email) limit 1;
  if sales_record.id is not null then
    update public.sales_team_codes
    set user_id = new.user_id, updated_at = now()
    where id = sales_record.id and user_id is distinct from new.user_id;

    new.role = 'sales';
    new.referral_code = sales_record.code;
    new.full_name = coalesce(nullif(new.full_name, ''), sales_record.name);
  end if;

  select * into admin_record from public.admin_accounts where lower(email) = lower(new.email) limit 1;
  if admin_record.id is not null then
    update public.admin_accounts
    set user_id = new.user_id, status = 'active', updated_at = now()
    where id = admin_record.id and user_id is distinct from new.user_id;

    new.role = admin_record.role;
    new.full_name = coalesce(nullif(new.full_name, ''), admin_record.full_name);
  end if;

  return new;
end;
$$;

drop trigger if exists idfit_profiles_sync_admin_sales on public.idfit_profiles;
create trigger idfit_profiles_sync_admin_sales
before insert or update of email, full_name, role, referral_code
on public.idfit_profiles
for each row execute function public.idfit_sync_profile_admin_sales();

create or replace function public.idfit_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_profile_count integer;
begin
  select count(*) into existing_profile_count from public.idfit_profiles;

  insert into public.idfit_profiles (user_id, full_name, email, referral_code, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    nullif(upper(coalesce(new.raw_user_meta_data ->> 'referral_code', '')), ''),
    case when existing_profile_count = 0 then 'owner'::public.idfit_app_role else 'customer'::public.idfit_app_role end
  )
  on conflict (user_id) do update set
    email = excluded.email,
    referral_code = coalesce(public.idfit_profiles.referral_code, excluded.referral_code),
    updated_at = now();

  return new;
end;
$$;

create or replace function public.idfit_admin_sales_summary()
returns table (
  id uuid,
  code text,
  name text,
  email text,
  status text,
  commission_percent numeric,
  user_id uuid,
  members_count bigint,
  orders_count bigint,
  gross_sales_usdt numeric,
  net_profit_usdt numeric,
  commission_usdt numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.code,
    s.name,
    s.email,
    s.status,
    s.commission_percent,
    s.user_id,
    count(distinct p.user_id) as members_count,
    count(o.id) filter (where o.status in ('payment_confirmed','purchasing','delivered','as_open')) as orders_count,
    coalesce(sum(o.sale_price_usdt) filter (where o.status in ('payment_confirmed','purchasing','delivered','as_open')), 0) as gross_sales_usdt,
    coalesce(sum(greatest(o.sale_price_usdt - o.supplier_cost_usdt, 0)) filter (where o.status in ('payment_confirmed','purchasing','delivered','as_open')), 0) as net_profit_usdt,
    coalesce(sum(o.commission_usdt) filter (where o.status in ('payment_confirmed','purchasing','delivered','as_open')), 0) as commission_usdt
  from public.sales_team_codes s
  left join public.idfit_profiles p on p.referral_code = s.code
  left join public.orders o on o.referral_code = s.code
  where public.idfit_has_role(auth.uid(), array['owner','admin','operator','support']::public.idfit_app_role[])
  group by s.id;
$$;

create or replace function public.idfit_my_sales_members()
returns table (
  user_id uuid,
  full_name text,
  email text,
  created_at timestamptz,
  orders_count bigint,
  gross_sales_usdt numeric,
  net_profit_usdt numeric,
  commission_usdt numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    p.full_name,
    p.email,
    p.created_at,
    count(o.id) filter (where o.status in ('payment_confirmed','purchasing','delivered','as_open')) as orders_count,
    coalesce(sum(o.sale_price_usdt) filter (where o.status in ('payment_confirmed','purchasing','delivered','as_open')), 0) as gross_sales_usdt,
    coalesce(sum(greatest(o.sale_price_usdt - o.supplier_cost_usdt, 0)) filter (where o.status in ('payment_confirmed','purchasing','delivered','as_open')), 0) as net_profit_usdt,
    coalesce(sum(o.commission_usdt) filter (where o.status in ('payment_confirmed','purchasing','delivered','as_open')), 0) as commission_usdt
  from public.sales_team_codes s
  join public.idfit_profiles p on p.referral_code = s.code
  left join public.orders o on o.user_id = p.user_id and o.referral_code = s.code
  where s.user_id = auth.uid()
  group by p.user_id, p.full_name, p.email, p.created_at
  order by p.created_at desc;
$$;

alter table public.admin_accounts enable row level security;
alter table public.sales_team_codes enable row level security;

drop policy if exists "owner_admin_manage_admin_accounts" on public.admin_accounts;
create policy "owner_admin_manage_admin_accounts" on public.admin_accounts
for all to authenticated
using (public.idfit_has_role(auth.uid(), array['owner','admin']::public.idfit_app_role[]))
with check (public.idfit_has_role(auth.uid(), array['owner','admin']::public.idfit_app_role[]));

drop policy if exists "staff_manage_sales_team_codes" on public.sales_team_codes;
create policy "staff_manage_sales_team_codes" on public.sales_team_codes
for all to authenticated
using (public.idfit_has_role(auth.uid(), array['owner','admin','operator','support']::public.idfit_app_role[]) or user_id = auth.uid())
with check (public.idfit_has_role(auth.uid(), array['owner','admin','operator']::public.idfit_app_role[]));

drop policy if exists "profiles_select_own_or_staff_or_sales" on public.idfit_profiles;
drop policy if exists "profiles_select_own_or_staff" on public.idfit_profiles;
create policy "profiles_select_own_or_staff_or_sales" on public.idfit_profiles
for select to authenticated
using (
  user_id = auth.uid()
  or public.idfit_has_role(auth.uid(), array['owner','admin','operator','support']::public.idfit_app_role[])
  or exists (select 1 from public.sales_team_codes s where s.user_id = auth.uid() and s.code = idfit_profiles.referral_code)
);

drop policy if exists "customers_select_own_orders" on public.orders;
create policy "customers_select_own_orders" on public.orders
for select to authenticated
using (
  user_id = auth.uid()
  or public.idfit_has_role(auth.uid(), array['owner','admin','operator','support']::public.idfit_app_role[])
  or exists (select 1 from public.sales_team_codes s where s.user_id = auth.uid() and s.code = orders.referral_code)
);

grant select, insert, update, delete on table public.admin_accounts to authenticated;
grant select, insert, update, delete on table public.sales_team_codes to authenticated;
grant select, insert, update, delete on table public.admin_accounts to service_role;
grant select, insert, update, delete on table public.sales_team_codes to service_role;
grant execute on function public.idfit_admin_sales_summary() to authenticated;
grant execute on function public.idfit_my_sales_members() to authenticated;

create index if not exists idx_admin_accounts_email on public.admin_accounts(lower(email));
create index if not exists idx_sales_team_codes_code on public.sales_team_codes(code);
create index if not exists idx_sales_team_codes_user_id on public.sales_team_codes(user_id);
create index if not exists idx_idfit_profiles_referral_code on public.idfit_profiles(referral_code);
create index if not exists idx_orders_referral_code on public.orders(referral_code);
