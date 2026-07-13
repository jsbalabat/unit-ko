-- Derived billing figures, computed not stored (prevents update anomalies that
-- come from keeping gross_due / paid_amount as columns).
create view public.v_billing_entries_full as
select
  be.*,
  coalesce(c.other_charges, 0) as other_charges,
  be.rent_due + coalesce(c.other_charges, 0) as gross_due,
  coalesce(p.paid_amount, 0) as paid_amount,
  (be.rent_due + coalesce(c.other_charges, 0)) - coalesce(p.paid_amount, 0) as balance
from public.billing_entries be
left join (
  select billing_entry_id, sum(amount) as other_charges
  from public.billing_charges
  group by billing_entry_id
) c on c.billing_entry_id = be.id
left join (
  select billing_entry_id, sum(amount) as paid_amount
  from public.payments
  where billing_entry_id is not null
  group by billing_entry_id
) p on p.billing_entry_id = be.id;

-- Occupancy derived from active leases (was a stored properties.occupancy_status
-- that had to be kept in sync by hand in every write path).
create view public.v_property_occupancy as
select
  pr.id as property_id,
  case
    when exists (
      select 1 from public.leases l
      where l.property_id = pr.id and l.status = 'active'
    ) then 'occupied'
    else 'vacant'
  end as occupancy_status
from public.properties pr;

-- Reproduces the old archived_tenants shape from ended leases + relations, so the
-- Archives UI keeps working without a denormalized snapshot table.
create view public.v_archived_tenants as
select
  l.id,
  l.property_id,
  pr.unit_name           as property_name,
  pr.property_type_code  as property_type,
  pr.property_location,
  t.tenant_name,
  t.contact_number,
  l.contract_periods     as contract_months,
  l.rent_start_date,
  l.rent_end_date,
  l.due_day,
  pr.rent_amount,
  coalesce(pay.total_paid, 0) as total_paid,
  coalesce(bill.total_due, 0) as total_due,
  l.end_reason           as archive_reason,
  l.ended_at             as archived_at,
  pr.landlord_id,
  l.created_at
from public.leases l
join public.tenants t     on t.id = l.tenant_id
join public.properties pr on pr.id = l.property_id
left join (
  select be.lease_id, sum(be.rent_due + coalesce(c.s, 0)) as total_due
  from public.billing_entries be
  left join (
    select billing_entry_id, sum(amount) as s
    from public.billing_charges
    group by billing_entry_id
  ) c on c.billing_entry_id = be.id
  group by be.lease_id
) bill on bill.lease_id = l.id
left join (
  select lease_id, sum(amount) as total_paid
  from public.payments
  group by lease_id
) pay on pay.lease_id = l.id
where l.status = 'ended';

-- Recent reminders resolved to the tenant/property they concern, with landlord_id
-- for ownership filtering. Backs the dashboard reminder-cycle feed (GET /reminders);
-- a read-only join that stores nothing.
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
