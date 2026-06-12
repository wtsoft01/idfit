-- Add website sales sources to the unified IDFIT collection engine.

alter type public.telegram_source_type add value if not exists 'website';
