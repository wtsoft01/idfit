-- Allow automatic collector exposure to safely upsert one product per parsed candidate.

create unique index if not exists idx_products_candidate_id_unique
  on public.products(candidate_id)
  where candidate_id is not null;
