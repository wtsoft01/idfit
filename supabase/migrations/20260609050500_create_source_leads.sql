-- Store discovered collection targets separately from approved live sources.
-- Admins review these leads before promoting them into telegram_sources.

create type public.source_lead_status as enum ('new', 'reviewing', 'approved', 'rejected', 'duplicate');

create or replace function public.idfit_update_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.source_leads (
  id uuid primary key default gen_random_uuid(),
  source_type public.telegram_source_type not null,
  identifier text not null,
  normalized_identifier text not null,
  status public.source_lead_status not null default 'new',
  confidence numeric(5,2) not null default 0.50,
  evidence text not null default '',
  evidence_kind text not null default 'raw_text',
  discovered_from_source_id uuid references public.telegram_sources(id) on delete set null,
  discovered_from_raw_message_id uuid references public.raw_messages(id) on delete set null,
  approved_source_id uuid references public.telegram_sources(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, normalized_identifier)
);

create trigger source_leads_updated_at
  before update on public.source_leads
  for each row execute function public.idfit_update_updated_at();

alter table public.source_leads enable row level security;

create policy "authenticated_manage_source_leads"
  on public.source_leads
  for all
  to authenticated
  using (true)
  with check (true);

create policy "service_role_manage_source_leads"
  on public.source_leads
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists idx_source_leads_status_created on public.source_leads(status, created_at desc);
create index if not exists idx_source_leads_from_source on public.source_leads(discovered_from_source_id, created_at desc);
