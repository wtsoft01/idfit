-- Add sales role before later migrations reference it.

alter type public.idfit_app_role add value if not exists 'sales';
