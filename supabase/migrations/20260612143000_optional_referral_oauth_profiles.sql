-- Make signup metadata optional and OAuth-friendly.
-- Referral sales code is optional; Google/OAuth users should receive a usable customer profile without extra email checks.

create or replace function public.idfit_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_profile_count integer;
  raw_referral_code text;
begin
  select count(*) into existing_profile_count from public.idfit_profiles;
  raw_referral_code = nullif(upper(coalesce(new.raw_user_meta_data ->> 'referral_code', '')), '');

  insert into public.idfit_profiles (user_id, full_name, email, referral_code, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, ''), '@', 1), ''),
    new.email,
    raw_referral_code,
    case when existing_profile_count = 0 then 'owner'::public.idfit_app_role else 'customer'::public.idfit_app_role end
  )
  on conflict (user_id) do update set
    full_name = coalesce(nullif(public.idfit_profiles.full_name, ''), excluded.full_name),
    email = coalesce(public.idfit_profiles.email, excluded.email),
    referral_code = coalesce(public.idfit_profiles.referral_code, excluded.referral_code),
    updated_at = now();

  return new;
end;
$$;
