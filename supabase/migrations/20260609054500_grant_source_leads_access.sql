-- Ensure PostgREST roles can access source lead review inbox after creation.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on table public.source_leads to service_role;
grant select, insert, update, delete on table public.source_leads to authenticated;
