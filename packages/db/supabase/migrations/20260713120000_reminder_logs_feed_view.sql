-- Flatten reminder_logs -> invoice -> lease -> tenant/property for the dashboard
-- reminder-cycle feed (GET /reminders), exposing landlord_id so the API filters by
-- owner. Read-only view; figures stay derived. service_role inherits SELECT via the
-- default privileges established in 20260615184500_grant_service_role.sql.
create view public.v_reminder_logs_full as
select
  rl.id,
  rl.billing_entry_id,
  rl.status_code,
  rl.channel_code,
  rl.last_error,
  rl.created_at,
  rl.sent_at,
  rl.delivered_at,
  be.due_date,
  t.tenant_name,
  pr.unit_name    as property_name,
  pr.landlord_id
from public.reminder_logs rl
join public.billing_entries be on be.id = rl.billing_entry_id
join public.leases l          on l.id = be.lease_id
join public.properties pr     on pr.id = l.property_id
left join public.tenants t    on t.id = l.tenant_id;
