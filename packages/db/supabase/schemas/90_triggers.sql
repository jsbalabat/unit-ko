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

