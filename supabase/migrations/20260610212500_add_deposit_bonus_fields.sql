-- Add prepaid deposit bonus and non-refundable credit fields.

alter table public.user_deposit_requests
  add column if not exists bonus_rate numeric(5,2) not null default 0,
  add column if not exists bonus_usdt numeric(12,4) not null default 0,
  add column if not exists credit_usdt numeric(12,4) not null default 0,
  add column if not exists is_refundable boolean not null default false;

update public.user_deposit_requests
set credit_usdt = amount_usdt + coalesce(bonus_usdt, 0)
where credit_usdt = 0;

alter table public.user_deposit_requests
  drop constraint if exists user_deposit_requests_bonus_rate_check,
  drop constraint if exists user_deposit_requests_bonus_usdt_check,
  drop constraint if exists user_deposit_requests_credit_usdt_check;

alter table public.user_deposit_requests
  add constraint user_deposit_requests_bonus_rate_check check (bonus_rate >= 0 and bonus_rate <= 10),
  add constraint user_deposit_requests_bonus_usdt_check check (bonus_usdt >= 0),
  add constraint user_deposit_requests_credit_usdt_check check (credit_usdt >= amount_usdt);

create or replace function public.idfit_apply_confirmed_deposit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  credit_amount numeric(12,4);
begin
  if new.status = 'confirmed' and (old.status is null or old.status <> 'confirmed') then
    credit_amount := greatest(coalesce(new.credit_usdt, 0), new.amount_usdt + coalesce(new.bonus_usdt, 0), new.amount_usdt);

    perform public.idfit_ensure_wallet_account(new.user_id);

    update public.user_wallet_accounts
    set balance_usdt = balance_usdt + credit_amount,
        updated_at = now()
    where user_id = new.user_id;

    insert into public.user_wallet_ledger (user_id, deposit_request_id, kind, amount_usdt, status, memo)
    values (
      new.user_id,
      new.id,
      'deposit',
      credit_amount,
      'confirmed',
      concat('예치금 충전 확인 · 입금 ', new.amount_usdt, ' USDT · 보너스 ', coalesce(new.bonus_usdt, 0), ' USDT · 환불불가')
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;
