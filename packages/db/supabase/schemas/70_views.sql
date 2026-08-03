-- Derived billing figures, computed not stored (prevents update anomalies that
-- come from keeping gross_due / paid_amount / status_code as columns).
--
-- Lease credit (an unallocated overpayment surplus — a payment row with no
-- billing_entry_id) is auto-applied here rather than moved by hand: it draws down
-- oldest-invoice-first against each open post-payment balance, so a covered
-- invoice reads a lower balance and a settled status the instant the credit
-- exists. Deposits/advances are lease-level facts and are excluded from the pool.
-- status_code runs the billing_entry_status ladder against the credit-inclusive
-- balance and the effective paid (cash + applied credit).
create view public.v_billing_entries_full as
with charges as (
  select billing_entry_id, sum(amount) as other_charges
  from public.billing_charges
  group by billing_entry_id
),
cash_paid as (
  select billing_entry_id, sum(amount) as paid_amount
  from public.payments
  where billing_entry_id is not null and voided_at is null
  group by billing_entry_id
),
lease_credit as (
  select lease_id, sum(amount) as pool
  from public.payments
  where billing_entry_id is null and voided_at is null
    and payment_type_code not in ('deposit', 'advance')
  group by lease_id
),
base as (
  select
    be.*,
    coalesce(c.other_charges, 0) as other_charges,
    be.rent_due + coalesce(c.other_charges, 0) as gross_due,
    coalesce(p.paid_amount, 0) as paid_amount,
    (be.rent_due + coalesce(c.other_charges, 0)) - coalesce(p.paid_amount, 0)
      as post_payment_balance
  from public.billing_entries be
  left join charges c on c.billing_entry_id = be.id
  left join cash_paid p on p.billing_entry_id = be.id
),
-- The credit a lease's older invoices have already claimed before this one, so
-- the remaining pool for this invoice is pool - prior_claimed.
credited as (
  select
    base.*,
    coalesce(lc.pool, 0) as credit_pool,
    coalesce(sum(greatest(base.post_payment_balance, 0)) over (
      partition by base.lease_id
      order by base.due_date asc nulls last, base.sequence asc nulls last, base.id
      rows between unbounded preceding and 1 preceding
    ), 0) as prior_claimed
  from base
  left join lease_credit lc on lc.lease_id = base.lease_id
),
applied as (
  select
    credited.*,
    greatest(0, least(post_payment_balance, credit_pool - prior_claimed))
      as applied_credit
  from credited
)
select
  id, lease_id, period_id, due_date, rent_due, sequence, created_at, updated_at,
  other_charges,
  gross_due,
  paid_amount,
  applied_credit,
  post_payment_balance - applied_credit as balance,
  public.billing_entry_status(
    gross_due,
    paid_amount + applied_credit,
    post_payment_balance - applied_credit,
    due_date
  ) as status_code
from applied;

-- Lease-level credit, so the app can show what's available rather than leaving an
-- overpayment surplus invisible until it draws down. credit_pool is the unallocated
-- credit (null-entry, non-voided, non-deposit/advance payments); credit_applied is
-- how much v_billing_entries_full has already drawn onto invoices; credit_available
-- is the remainder. landlord_id rides along for ownership filtering.
create view public.v_lease_credit as
select
  l.id as lease_id,
  pr.landlord_id,
  coalesce(cr.pool, 0) as credit_pool,
  coalesce(ap.applied, 0) as credit_applied,
  coalesce(cr.pool, 0) - coalesce(ap.applied, 0) as credit_available
from public.leases l
join public.properties pr on pr.id = l.property_id
left join (
  select lease_id, sum(amount) as pool
  from public.payments
  where billing_entry_id is null and voided_at is null
    and payment_type_code not in ('deposit', 'advance')
  group by lease_id
) cr on cr.lease_id = l.id
left join (
  select lease_id, sum(applied_credit) as applied
  from public.v_billing_entries_full
  group by lease_id
) ap on ap.lease_id = l.id;

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
  where voided_at is null
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

-- Tenant bill-responses resolved to the tenant/property and bill they concern, with
-- landlord_id for ownership filtering. Backs the landlord's Tenant Responses panel
-- (GET /responses); a read-only join.
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
  pr.landlord_id,
  tr.tenant_id
from public.tenant_responses tr
join public.tenant_response_types rt on rt.code = tr.response_type_code
join public.billing_entries be       on be.id = tr.billing_entry_id
join public.leases l                  on l.id = be.lease_id
join public.properties pr             on pr.id = l.property_id
join public.tenants t                 on t.id = tr.tenant_id;
