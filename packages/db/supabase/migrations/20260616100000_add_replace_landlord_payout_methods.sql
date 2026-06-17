-- Atomic replace of a landlord's payout channels. The API sends the complete
-- desired set; methods omitted are removed. Runs under the service-role key with
-- the verified landlord id passed in (auth.uid() is NULL there). Hand-authored:
-- `supabase db diff` does not emit the revoke/grant, so it's included here and
-- execution is locked to service_role.
create or replace function public.replace_landlord_payout_methods(
  p_landlord_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_method jsonb;
begin
  if p_landlord_id is null then raise exception 'landlord id is required'; end if;

  delete from public.landlord_payout_methods where landlord_id = p_landlord_id;

  for v_method in
    select * from jsonb_array_elements(coalesce(p_payload, '[]'::jsonb))
  loop
    if nullif(v_method->>'method', '') is null then continue; end if;
    insert into public.landlord_payout_methods
      (landlord_id, method, account_name, account_number, details)
    values (
      p_landlord_id,
      v_method->>'method',
      nullif(v_method->>'accountName', ''),
      nullif(v_method->>'accountNumber', ''),
      nullif(v_method->>'details', '')
    );
  end loop;
end;
$$;

revoke execute on function public.replace_landlord_payout_methods(uuid, jsonb) from public;
grant execute on function public.replace_landlord_payout_methods(uuid, jsonb) to service_role;
