do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'idfit_app_role') then
    create type public.idfit_app_role as enum ('owner', 'admin', 'operator', 'support', 'customer');
  end if;
end $$;

create or replace function public.idfit_has_role(_user_id uuid, _roles public.idfit_app_role[])
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  role_names text[] := array(select unnest(_roles)::text);
  has_role boolean := false;
begin
  if to_regclass('public.idfit_profiles') is not null then
    execute 'select exists(select 1 from public.idfit_profiles where user_id = $1 and role::text = any($2))'
      into has_role
      using _user_id, role_names;
  elsif to_regclass('public.dealfinder_profiles') is not null then
    execute 'select exists(select 1 from public.dealfinder_profiles where user_id = $1 and role::text = any($2))'
      into has_role
      using _user_id, role_names;
  end if;

  return coalesce(has_role, false);
end;
$$;

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  as_ticket_id uuid references public.as_tickets(id) on delete set null,
  topic text not null default 'general',
  sender_role text not null check (sender_role in ('customer', 'admin', 'system')),
  sender_id uuid references auth.users(id) on delete set null,
  body text not null default '',
  read_by_customer_at timestamptz,
  read_by_staff_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.support_messages enable row level security;

drop policy if exists "customers_select_own_support_messages" on public.support_messages;
drop policy if exists "customers_insert_own_support_messages" on public.support_messages;
drop policy if exists "staff_manage_support_messages" on public.support_messages;

create policy "customers_select_own_support_messages"
  on public.support_messages
  for select
  to authenticated
  using (user_id = auth.uid() or public.idfit_has_role(auth.uid(), array['owner','admin','operator','support']::public.idfit_app_role[]));

create policy "customers_insert_own_support_messages"
  on public.support_messages
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and sender_id = auth.uid()
    and sender_role = 'customer'
  );

create policy "staff_manage_support_messages"
  on public.support_messages
  for all
  to authenticated
  using (public.idfit_has_role(auth.uid(), array['owner','admin','operator','support']::public.idfit_app_role[]))
  with check (public.idfit_has_role(auth.uid(), array['owner','admin','operator','support']::public.idfit_app_role[]));

create index if not exists idx_support_messages_user_created on public.support_messages(user_id, created_at desc);
create index if not exists idx_support_messages_order_created on public.support_messages(order_id, created_at desc);
create index if not exists idx_support_messages_as_ticket_created on public.support_messages(as_ticket_id, created_at desc);

grant select, insert, update, delete on table public.support_messages to authenticated;
grant select, insert, update, delete on table public.support_messages to service_role;
