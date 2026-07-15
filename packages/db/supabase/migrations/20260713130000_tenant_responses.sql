-- Tenant bill-responses (acknowledge / will pay / already paid / dispute) with an
-- optional note, plus the landlord's confirm-receipt stamp. New lookup + table +
-- feed view. service_role inherits privileges via the default privileges set in
-- 20260615184500_grant_service_role.sql; RLS is a deny-by-default backstop, with the
-- lookup readable to everyone like the other reference tables.
create table public.tenant_response_types (
  code text primary key,
  label text not null
);

insert into public.tenant_response_types (code, label) values
  ('acknowledged', 'Acknowledged'),
  ('will_pay', 'Will pay'),
  ('already_paid', 'Already paid'),
  ('disputed', 'Dispute')
on conflict (code) do nothing;

create table public.tenant_responses (
  id uuid primary key default gen_random_uuid(),
  billing_entry_id uuid not null references public.billing_entries(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  response_type_code text not null references public.tenant_response_types(code),
  note text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id)
);

create index idx_tenant_responses_entry on public.tenant_responses (billing_entry_id, created_at);

create view public.v_tenant_responses_full as
select
  tr.id,
  tr.billing_entry_id,
  tr.response_type_code,
  rt.label          as response_type_label,
  tr.note,
  tr.created_at,
  tr.confirmed_at,
  tr.confirmed_by,
  be.due_date,
  t.tenant_name,
  pr.unit_name      as property_name,
  pr.landlord_id
from public.tenant_responses tr
join public.tenant_response_types rt on rt.code = tr.response_type_code
join public.billing_entries be       on be.id = tr.billing_entry_id
join public.leases l                  on l.id = be.lease_id
join public.properties pr             on pr.id = l.property_id
join public.tenants t                 on t.id = tr.tenant_id;

alter table public.tenant_response_types enable row level security;
alter table public.tenant_responses enable row level security;

create policy tenant_response_types_read
  on public.tenant_response_types for select to anon, authenticated using (true);
