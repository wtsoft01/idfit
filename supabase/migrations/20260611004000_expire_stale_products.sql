-- Hide stale or depleted collected products from the customer catalog.

create or replace function public.idfit_expire_stale_products(dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  stale_count integer := 0;
  depleted_count integer := 0;
begin
  select count(*) into stale_count
  from public.products p
  join public.product_candidates pc on pc.id = p.candidate_id
  where p.status = 'visible'
    and p.stock_state in ('in_stock', 'low')
    and pc.freshness_expires_at is not null
    and pc.freshness_expires_at < now();

  select count(*) into depleted_count
  from public.products p
  where p.status = 'visible'
    and (
      p.stock_state = 'sold_out'
      or coalesce(p.stock_count, 1) <= 0
    );

  if not dry_run then
    update public.product_candidates pc
    set status = 'expired', updated_at = now()
    from public.products p
    where p.candidate_id = pc.id
      and p.status = 'visible'
      and p.stock_state in ('in_stock', 'low')
      and pc.freshness_expires_at is not null
      and pc.freshness_expires_at < now();

    update public.products p
    set status = 'expired', stock_state = 'sold_out', stock_count = 0, updated_at = now()
    from public.product_candidates pc
    where pc.id = p.candidate_id
      and p.status = 'visible'
      and p.stock_state in ('in_stock', 'low')
      and pc.freshness_expires_at is not null
      and pc.freshness_expires_at < now();

    update public.products p
    set status = 'sold_out', stock_state = 'sold_out', stock_count = 0, updated_at = now()
    where p.status = 'visible'
      and (
        p.stock_state = 'sold_out'
        or coalesce(p.stock_count, 1) <= 0
      );
  end if;

  return jsonb_build_object(
    'dry_run', dry_run,
    'stale_products', stale_count,
    'depleted_products', depleted_count
  );
end;
$$;

revoke all on function public.idfit_expire_stale_products(boolean) from public;
grant execute on function public.idfit_expire_stale_products(boolean) to service_role;
