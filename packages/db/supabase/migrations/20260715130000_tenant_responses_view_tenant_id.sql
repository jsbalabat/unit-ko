-- The tenant-facing GET /tenant/responses scopes a tenant to their own responses,
-- which needs tenant_id exposed on the feed view (20260713130000 only exposed
-- landlord_id, for the landlord side). Appended at the end so create-or-replace is
-- valid — a replaced view may only gain columns, never reorder existing ones.
-- Desired state lives in schemas/70_views.sql.
create or replace view public.v_tenant_responses_full as
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
  pr.landlord_id,
  tr.tenant_id
from public.tenant_responses tr
join public.tenant_response_types rt on rt.code = tr.response_type_code
join public.billing_entries be       on be.id = tr.billing_entry_id
join public.leases l                  on l.id = be.lease_id
join public.properties pr             on pr.id = l.property_id
join public.tenants t                 on t.id = tr.tenant_id;
