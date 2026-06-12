-- Add stable candidate fingerprints for large-scale collector deduplication.

create extension if not exists pgcrypto with schema extensions;

alter table public.product_candidates
  add column if not exists supplier_original_amount numeric(12,4),
  add column if not exists candidate_fingerprint text;

update public.product_candidates
set supplier_original_amount = coalesce(
  supplier_original_amount,
  nullif(metadata->>'original_price', '')::numeric
)
where supplier_original_amount is null
  and metadata ? 'original_price'
  and (metadata->>'original_price') ~ '^[0-9]+(\.[0-9]+)?$';

update public.product_candidates
set candidate_fingerprint = encode(
  extensions.digest(
    lower(coalesce(source_id::text, '') || '|' || coalesce(product_title, '') || '|' || coalesce(supplier_currency, '') || '|' || coalesce(supplier_original_amount::text, supplier_cost_usdt::text, '') || '|' || coalesce(stock_state::text, '')),
    'sha256'
  ),
  'hex'
)
where candidate_fingerprint is null;

with ranked_candidates as (
  select
    id,
    row_number() over (
      partition by source_id, candidate_fingerprint
      order by created_at desc, id desc
    ) as duplicate_rank
  from public.product_candidates
  where candidate_fingerprint is not null
)
update public.product_candidates candidate
set
  status = 'rejected',
  metadata = coalesce(candidate.metadata, '{}'::jsonb) || jsonb_build_object(
    'dedupe_status', 'duplicate_rejected_before_fingerprint_unique_index',
    'deduped_at', now()
  )
from ranked_candidates ranked
where candidate.id = ranked.id
  and ranked.duplicate_rank > 1;

alter table public.product_candidates
  alter column candidate_fingerprint set not null;

create unique index if not exists idx_product_candidates_source_fingerprint_unique
  on public.product_candidates (source_id, candidate_fingerprint)
  where status <> 'rejected';

create index if not exists idx_product_candidates_currency_status
  on public.product_candidates (supplier_currency, status);
