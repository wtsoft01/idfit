-- Store editable IDFIT app settings such as payment wallet addresses.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "authenticated_read_payment_settings" on public.app_settings;
drop policy if exists "owner_admin_manage_app_settings" on public.app_settings;

create policy "authenticated_read_payment_settings" on public.app_settings
  for select to authenticated
  using (key = 'payment');

create policy "owner_admin_manage_app_settings" on public.app_settings
  for all to authenticated
  using (public.idfit_has_role(auth.uid(), array['owner','admin']::public.idfit_app_role[]))
  with check (public.idfit_has_role(auth.uid(), array['owner','admin']::public.idfit_app_role[]));

grant select, insert, update, delete on table public.app_settings to authenticated;
grant select, insert, update, delete on table public.app_settings to service_role;

insert into public.app_settings (key, value)
values (
  'payment',
  jsonb_build_object(
    'paymentWindowMinutes', 60,
    'wallets', jsonb_build_array(
      jsonb_build_object('id', 'usdt-trc20', 'asset', 'USDT', 'network', 'TRC20', 'label', 'USDT TRC20', 'address', '', 'enabled', true, 'autoConfirm', true, 'memo', ''),
      jsonb_build_object('id', 'usdt-bep20', 'asset', 'USDT', 'network', 'BEP20', 'label', 'USDT BEP20', 'address', '', 'enabled', false, 'autoConfirm', true, 'memo', '')
    )
  )
)
on conflict (key) do nothing;
