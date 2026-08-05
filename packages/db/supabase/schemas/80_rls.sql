-- Security model: the NestJS API is the only client that touches these tables,
-- and it connects with the service-role key (which bypasses RLS). The browser no
-- longer holds a data key. So we enable RLS everywhere as a deny-by-default
-- backstop — if the anon/authenticated key is ever used directly, it sees
-- nothing. Fine-grained per-role policies can be layered on later if direct
-- client access is reintroduced.

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.landlord_payout_methods enable row level security;
alter table public.properties enable row level security;
alter table public.property_notes enable row level security;
alter table public.property_amenities enable row level security;
alter table public.tenants enable row level security;
alter table public.leases enable row level security;
alter table public.billing_periods enable row level security;
alter table public.billing_entries enable row level security;
alter table public.billing_charges enable row level security;
alter table public.billing_entry_revisions enable row level security;
alter table public.payments enable row level security;
alter table public.reminder_logs enable row level security;
alter table public.activity_logs enable row level security;
alter table public.tenant_responses enable row level security;
alter table public.tenant_transfer_requests enable row level security;

-- Lookups are non-sensitive reference data; expose read-only to everyone.
alter table public.property_types enable row level security;
alter table public.billing_statuses enable row level security;
alter table public.billing_frequencies enable row level security;
alter table public.payment_types enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscription_statuses enable row level security;
alter table public.activity_action_types enable row level security;
alter table public.reminder_channels enable row level security;
alter table public.reminder_statuses enable row level security;
alter table public.amenities enable row level security;
alter table public.tenant_response_types enable row level security;

create policy property_types_read on public.property_types for select to anon, authenticated using (true);
create policy billing_statuses_read on public.billing_statuses for select to anon, authenticated using (true);
create policy billing_frequencies_read on public.billing_frequencies for select to anon, authenticated using (true);
create policy payment_types_read on public.payment_types for select to anon, authenticated using (true);
create policy subscription_plans_read on public.subscription_plans for select to anon, authenticated using (true);
create policy subscription_statuses_read on public.subscription_statuses for select to anon, authenticated using (true);
create policy activity_action_types_read on public.activity_action_types for select to anon, authenticated using (true);
create policy reminder_channels_read on public.reminder_channels for select to anon, authenticated using (true);
create policy reminder_statuses_read on public.reminder_statuses for select to anon, authenticated using (true);
create policy amenities_read on public.amenities for select to anon, authenticated using (true);
create policy tenant_response_types_read on public.tenant_response_types for select to anon, authenticated using (true);
