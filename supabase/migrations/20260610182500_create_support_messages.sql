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
