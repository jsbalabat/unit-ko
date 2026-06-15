-- Stamp updated_at on UPDATE for every table that carries the column.
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger trg_payout_methods_updated_at before update on public.landlord_payout_methods
  for each row execute function public.set_updated_at();
create trigger trg_properties_updated_at before update on public.properties
  for each row execute function public.set_updated_at();
create trigger trg_property_notes_updated_at before update on public.property_notes
  for each row execute function public.set_updated_at();
create trigger trg_tenants_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();
create trigger trg_leases_updated_at before update on public.leases
  for each row execute function public.set_updated_at();
create trigger trg_billing_entries_updated_at before update on public.billing_entries
  for each row execute function public.set_updated_at();

-- Tenant-facing read of their landlord's payout methods, by property.
-- SECURITY DEFINER so the API can return only payout fields without exposing the
-- rest of the landlord's profile.
create or replace function public.get_landlord_payout_methods(p_property_id uuid)
returns table (
  method text,
  account_name text,
  account_number text,
  details text,
  landlord_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_landlord uuid;
begin
  select landlord_id into v_landlord from public.properties where id = p_property_id;
  if v_landlord is null then
    return;
  end if;

  return query
    select m.method, m.account_name, m.account_number, m.details, pr.full_name
    from public.landlord_payout_methods m
    join public.profiles pr on pr.id = m.landlord_id
    where m.landlord_id = v_landlord;
end;
$$;
