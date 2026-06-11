-- Record collector health on existing source rows without adding new product features.

create or replace function public.idfit_record_source_sync_result(
  source_id_input uuid,
  ok_input boolean,
  collector_input text default 'unknown',
  exit_code_input integer default null,
  message_input text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_metadata jsonb;
  current_failures integer;
  next_failures integer;
  next_metadata jsonb;
begin
  select coalesce(metadata, '{}'::jsonb) into current_metadata
  from public.telegram_sources
  where id = source_id_input
  for update;

  if current_metadata is null then
    return jsonb_build_object('ok', false, 'reason', 'source_not_found');
  end if;

  current_failures := coalesce((current_metadata->>'collector_consecutive_failures')::integer, 0);
  next_failures := case when ok_input then 0 else current_failures + 1 end;

  next_metadata := current_metadata
    || jsonb_build_object(
      'collector_last_checked_at', now(),
      'collector_last_name', collector_input,
      'collector_last_ok', ok_input,
      'collector_last_exit_code', exit_code_input,
      'collector_consecutive_failures', next_failures
    );

  if ok_input then
    next_metadata := next_metadata || jsonb_build_object('collector_last_success_at', now());
  else
    next_metadata := next_metadata || jsonb_build_object(
      'collector_last_failure_at', now(),
      'collector_last_error', left(coalesce(message_input, 'collector failed'), 500)
    );
  end if;

  update public.telegram_sources
  set metadata = next_metadata,
      status = case when not ok_input and next_failures >= 5 then 'throttled'::public.source_status else status end,
      updated_at = now()
  where id = source_id_input;

  return jsonb_build_object(
    'ok', true,
    'source_id', source_id_input,
    'collector_ok', ok_input,
    'consecutive_failures', next_failures
  );
end;
$$;

revoke all on function public.idfit_record_source_sync_result(uuid, boolean, text, integer, text) from public;
grant execute on function public.idfit_record_source_sync_result(uuid, boolean, text, integer, text) to service_role;
