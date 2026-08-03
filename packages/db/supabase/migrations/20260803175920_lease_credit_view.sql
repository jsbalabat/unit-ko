drop view if exists "public"."v_archived_tenants";

drop view if exists "public"."v_billing_entries_full";

drop view if exists "public"."v_reminder_logs_full";

create or replace view "public"."v_archived_tenants" as  SELECT l.id,
    l.property_id,
    pr.unit_name AS property_name,
    pr.property_type_code AS property_type,
    pr.property_location,
    t.tenant_name,
    t.contact_number,
    l.contract_periods AS contract_months,
    l.rent_start_date,
    l.rent_end_date,
    l.due_day,
    pr.rent_amount,
    COALESCE(pay.total_paid, (0)::numeric) AS total_paid,
    COALESCE(bill.total_due, (0)::numeric) AS total_due,
    l.end_reason AS archive_reason,
    l.ended_at AS archived_at,
    pr.landlord_id,
    l.created_at
   FROM ((((public.leases l
     JOIN public.tenants t ON ((t.id = l.tenant_id)))
     JOIN public.properties pr ON ((pr.id = l.property_id)))
     LEFT JOIN ( SELECT be.lease_id,
            sum((be.rent_due + COALESCE(c.s, (0)::numeric))) AS total_due
           FROM (public.billing_entries be
             LEFT JOIN ( SELECT billing_charges.billing_entry_id,
                    sum(billing_charges.amount) AS s
                   FROM public.billing_charges
                  GROUP BY billing_charges.billing_entry_id) c ON ((c.billing_entry_id = be.id)))
          GROUP BY be.lease_id) bill ON ((bill.lease_id = l.id)))
     LEFT JOIN ( SELECT payments.lease_id,
            sum(payments.amount) AS total_paid
           FROM public.payments
          WHERE (payments.voided_at IS NULL)
          GROUP BY payments.lease_id) pay ON ((pay.lease_id = l.id)))
  WHERE (l.status = 'ended'::text);


create or replace view "public"."v_billing_entries_full" as  WITH charges AS (
         SELECT billing_charges.billing_entry_id,
            sum(billing_charges.amount) AS other_charges
           FROM public.billing_charges
          GROUP BY billing_charges.billing_entry_id
        ), cash_paid AS (
         SELECT payments.billing_entry_id,
            sum(payments.amount) AS paid_amount
           FROM public.payments
          WHERE ((payments.billing_entry_id IS NOT NULL) AND (payments.voided_at IS NULL))
          GROUP BY payments.billing_entry_id
        ), lease_credit AS (
         SELECT payments.lease_id,
            sum(payments.amount) AS pool
           FROM public.payments
          WHERE ((payments.billing_entry_id IS NULL) AND (payments.voided_at IS NULL) AND (payments.payment_type_code <> ALL (ARRAY['deposit'::text, 'advance'::text])))
          GROUP BY payments.lease_id
        ), base AS (
         SELECT be.id,
            be.lease_id,
            be.period_id,
            be.due_date,
            be.rent_due,
            be.sequence,
            be.created_at,
            be.updated_at,
            COALESCE(c.other_charges, (0)::numeric) AS other_charges,
            (be.rent_due + COALESCE(c.other_charges, (0)::numeric)) AS gross_due,
            COALESCE(p.paid_amount, (0)::numeric) AS paid_amount,
            ((be.rent_due + COALESCE(c.other_charges, (0)::numeric)) - COALESCE(p.paid_amount, (0)::numeric)) AS post_payment_balance
           FROM ((public.billing_entries be
             LEFT JOIN charges c ON ((c.billing_entry_id = be.id)))
             LEFT JOIN cash_paid p ON ((p.billing_entry_id = be.id)))
        ), credited AS (
         SELECT base.id,
            base.lease_id,
            base.period_id,
            base.due_date,
            base.rent_due,
            base.sequence,
            base.created_at,
            base.updated_at,
            base.other_charges,
            base.gross_due,
            base.paid_amount,
            base.post_payment_balance,
            COALESCE(lc.pool, (0)::numeric) AS credit_pool,
            COALESCE(sum(GREATEST(base.post_payment_balance, (0)::numeric)) OVER (PARTITION BY base.lease_id ORDER BY base.due_date, base.sequence, base.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), (0)::numeric) AS prior_claimed
           FROM (base
             LEFT JOIN lease_credit lc ON ((lc.lease_id = base.lease_id)))
        ), applied AS (
         SELECT credited.id,
            credited.lease_id,
            credited.period_id,
            credited.due_date,
            credited.rent_due,
            credited.sequence,
            credited.created_at,
            credited.updated_at,
            credited.other_charges,
            credited.gross_due,
            credited.paid_amount,
            credited.post_payment_balance,
            credited.credit_pool,
            credited.prior_claimed,
            GREATEST((0)::numeric, LEAST(credited.post_payment_balance, (credited.credit_pool - credited.prior_claimed))) AS applied_credit
           FROM credited
        )
 SELECT id,
    lease_id,
    period_id,
    due_date,
    rent_due,
    sequence,
    created_at,
    updated_at,
    other_charges,
    gross_due,
    paid_amount,
    applied_credit,
    (post_payment_balance - applied_credit) AS balance,
    public.billing_entry_status(gross_due, (paid_amount + applied_credit), (post_payment_balance - applied_credit), due_date) AS status_code
   FROM applied;


create or replace view "public"."v_reminder_logs_full" as  SELECT rl.id,
    rl.billing_entry_id,
    rl.status_code,
    rl.channel_code,
    rl.last_error,
    rl.created_at,
    rl.sent_at,
    rl.delivered_at,
    be.due_date,
    t.tenant_name,
    pr.unit_name AS property_name,
    pr.landlord_id
   FROM ((((public.reminder_logs rl
     JOIN public.billing_entries be ON ((be.id = rl.billing_entry_id)))
     JOIN public.leases l ON ((l.id = be.lease_id)))
     JOIN public.properties pr ON ((pr.id = l.property_id)))
     LEFT JOIN public.tenants t ON ((t.id = l.tenant_id)));


create or replace view "public"."v_lease_credit" as  SELECT l.id AS lease_id,
    pr.landlord_id,
    COALESCE(cr.pool, (0)::numeric) AS credit_pool,
    COALESCE(ap.applied, (0)::numeric) AS credit_applied,
    (COALESCE(cr.pool, (0)::numeric) - COALESCE(ap.applied, (0)::numeric)) AS credit_available
   FROM (((public.leases l
     JOIN public.properties pr ON ((pr.id = l.property_id)))
     LEFT JOIN ( SELECT payments.lease_id,
            sum(payments.amount) AS pool
           FROM public.payments
          WHERE ((payments.billing_entry_id IS NULL) AND (payments.voided_at IS NULL) AND (payments.payment_type_code <> ALL (ARRAY['deposit'::text, 'advance'::text])))
          GROUP BY payments.lease_id) cr ON ((cr.lease_id = l.id)))
     LEFT JOIN ( SELECT v_billing_entries_full.lease_id,
            sum(v_billing_entries_full.applied_credit) AS applied
           FROM public.v_billing_entries_full
          GROUP BY v_billing_entries_full.lease_id) ap ON ((ap.lease_id = l.id)));

-- db diff never emits grants; re-grant the API role read access on the views this
-- migration recreated, and grant the new v_lease_credit.
grant select on public.v_billing_entries_full to service_role;
grant select on public.v_archived_tenants to service_role;
grant select on public.v_reminder_logs_full to service_role;
grant select on public.v_lease_credit to service_role;



