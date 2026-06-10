create unique index if not exists idx_orders_pending_payment_amount_unique
on public.orders (
  payment_network,
  payment_address,
  sale_price_usdt
)
where status = 'payment_pending'
  and payment_address is not null;
