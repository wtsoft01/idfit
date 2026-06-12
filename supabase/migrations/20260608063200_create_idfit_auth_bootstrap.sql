-- IDFIT auth profile bootstrap
-- Creates a IDFIT profile for every new auth user.
-- The first registered user becomes owner; later users become customer by default.

create or replace function public.idfit_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_profile_count integer;
begin
  select count(*) into existing_profile_count from public.idfit_profiles;

  insert into public.idfit_profiles (user_id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when existing_profile_count = 0 then 'owner'::public.idfit_app_role else 'customer'::public.idfit_app_role end
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists idfit_on_auth_user_created on auth.users;
create trigger idfit_on_auth_user_created
  after insert on auth.users
  for each row execute function public.idfit_handle_new_user();

create policy "profiles_insert_self" on public.idfit_profiles
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "owners_manage_profiles" on public.idfit_profiles
  for all to authenticated
  using (public.idfit_has_role(auth.uid(), array['owner','admin']::public.idfit_app_role[]))
  with check (public.idfit_has_role(auth.uid(), array['owner','admin']::public.idfit_app_role[]));


