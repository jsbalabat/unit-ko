drop view if exists "public"."v_archived_tenants";

drop view if exists "public"."v_lease_credit";

drop view if exists "public"."v_property_occupancy";

drop view if exists "public"."v_reminder_logs_full";

drop view if exists "public"."v_tenant_responses_full";

drop view if exists "public"."v_billing_entries_full";


  create table "public"."tenant_transfer_requests" (
    "id" uuid not null default gen_random_uuid(),
    "tenant_id" uuid not null,
    "from_property_id" uuid,
    "from_lease_id" uuid,
    "to_property_id" uuid not null,
    "status" text not null default 'pending'::text,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "resolved_at" timestamp with time zone
      );


alter table "public"."tenant_transfer_requests" enable row level security;

CREATE INDEX idx_transfer_requests_tenant ON public.tenant_transfer_requests USING btree (tenant_id);

CREATE UNIQUE INDEX tenant_transfer_requests_pkey ON public.tenant_transfer_requests USING btree (id);

CREATE UNIQUE INDEX uq_pending_transfer_per_tenant ON public.tenant_transfer_requests USING btree (tenant_id) WHERE (status = 'pending'::text);

alter table "public"."tenant_transfer_requests" add constraint "tenant_transfer_requests_pkey" PRIMARY KEY using index "tenant_transfer_requests_pkey";

alter table "public"."tenant_transfer_requests" add constraint "tenant_transfer_requests_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."tenant_transfer_requests" validate constraint "tenant_transfer_requests_created_by_fkey";

alter table "public"."tenant_transfer_requests" add constraint "tenant_transfer_requests_from_lease_id_fkey" FOREIGN KEY (from_lease_id) REFERENCES public.leases(id) ON DELETE SET NULL not valid;

alter table "public"."tenant_transfer_requests" validate constraint "tenant_transfer_requests_from_lease_id_fkey";

alter table "public"."tenant_transfer_requests" add constraint "tenant_transfer_requests_from_property_id_fkey" FOREIGN KEY (from_property_id) REFERENCES public.properties(id) ON DELETE SET NULL not valid;

alter table "public"."tenant_transfer_requests" validate constraint "tenant_transfer_requests_from_property_id_fkey";

alter table "public"."tenant_transfer_requests" add constraint "tenant_transfer_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text, 'cancelled'::text]))) not valid;

alter table "public"."tenant_transfer_requests" validate constraint "tenant_transfer_requests_status_check";

alter table "public"."tenant_transfer_requests" add constraint "tenant_transfer_requests_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE not valid;

alter table "public"."tenant_transfer_requests" validate constraint "tenant_transfer_requests_tenant_id_fkey";

alter table "public"."tenant_transfer_requests" add constraint "tenant_transfer_requests_to_property_id_fkey" FOREIGN KEY (to_property_id) REFERENCES public.properties(id) ON DELETE CASCADE not valid;

alter table "public"."tenant_transfer_requests" validate constraint "tenant_transfer_requests_to_property_id_fkey";

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
            be.transferred_at,
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
            base.transferred_at,
            base.created_at,
            base.updated_at,
            base.other_charges,
            base.gross_due,
            base.paid_amount,
            base.post_payment_balance,
            COALESCE(lc.pool, (0)::numeric) AS credit_pool,
            COALESCE(sum(GREATEST(
                CASE
                    WHEN (base.transferred_at IS NULL) THEN base.post_payment_balance
                    ELSE (0)::numeric
                END, (0)::numeric)) OVER (PARTITION BY base.lease_id ORDER BY base.due_date, base.sequence, base.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), (0)::numeric) AS prior_claimed
           FROM (base
             LEFT JOIN lease_credit lc ON ((lc.lease_id = base.lease_id)))
        ), applied AS (
         SELECT credited.id,
            credited.lease_id,
            credited.period_id,
            credited.due_date,
            credited.rent_due,
            credited.sequence,
            credited.transferred_at,
            credited.created_at,
            credited.updated_at,
            credited.other_charges,
            credited.gross_due,
            credited.paid_amount,
            credited.post_payment_balance,
            credited.credit_pool,
            credited.prior_claimed,
                CASE
                    WHEN (credited.transferred_at IS NOT NULL) THEN (0)::numeric
                    ELSE GREATEST((0)::numeric, LEAST(credited.post_payment_balance, (credited.credit_pool - credited.prior_claimed)))
                END AS applied_credit
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
    transferred_at,
    other_charges,
    gross_due,
    paid_amount,
    applied_credit,
        CASE
            WHEN (transferred_at IS NOT NULL) THEN (0)::numeric
            ELSE (post_payment_balance - applied_credit)
        END AS balance,
        CASE
            WHEN (transferred_at IS NOT NULL) THEN 'Transferred'::text
            ELSE public.billing_entry_status(gross_due, (paid_amount + applied_credit), (post_payment_balance - applied_credit), due_date)
        END AS status_code
   FROM applied;


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


create or replace view "public"."v_property_occupancy" as  SELECT id AS property_id,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM public.leases l
              WHERE ((l.property_id = pr.id) AND (l.status = 'active'::text)))) THEN 'occupied'::text
            ELSE 'vacant'::text
        END AS occupancy_status
   FROM public.properties pr;


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


create or replace view "public"."v_tenant_responses_full" as  SELECT tr.id,
    tr.billing_entry_id,
    tr.response_type_code,
    rt.label AS response_type_label,
    tr.note,
    tr.created_at,
    tr.confirmed_at,
    tr.confirmed_by,
    be.due_date,
    t.tenant_name,
    pr.unit_name AS property_name,
    pr.landlord_id,
    tr.tenant_id
   FROM (((((public.tenant_responses tr
     JOIN public.tenant_response_types rt ON ((rt.code = tr.response_type_code)))
     JOIN public.billing_entries be ON ((be.id = tr.billing_entry_id)))
     JOIN public.leases l ON ((l.id = be.lease_id)))
     JOIN public.properties pr ON ((pr.id = l.property_id)))
     JOIN public.tenants t ON ((t.id = tr.tenant_id)));


grant references on table "public"."tenant_transfer_requests" to "anon";

grant trigger on table "public"."tenant_transfer_requests" to "anon";

grant truncate on table "public"."tenant_transfer_requests" to "anon";

grant references on table "public"."tenant_transfer_requests" to "authenticated";

grant trigger on table "public"."tenant_transfer_requests" to "authenticated";

grant truncate on table "public"."tenant_transfer_requests" to "authenticated";

grant delete on table "public"."tenant_transfer_requests" to "service_role";

grant insert on table "public"."tenant_transfer_requests" to "service_role";

grant references on table "public"."tenant_transfer_requests" to "service_role";

grant select on table "public"."tenant_transfer_requests" to "service_role";

grant trigger on table "public"."tenant_transfer_requests" to "service_role";

grant truncate on table "public"."tenant_transfer_requests" to "service_role";

grant update on table "public"."tenant_transfer_requests" to "service_role";


-- === hand-appended: db diff strips view grants and omits seed data ===

-- The six views were dropped + recreated above, wiping their grants. Restore SELECT
-- for the service-role API on all of them.
grant select on public.v_billing_entries_full to service_role;
grant select on public.v_lease_credit to service_role;
grant select on public.v_archived_tenants to service_role;
grant select on public.v_property_occupancy to service_role;
grant select on public.v_reminder_logs_full to service_role;
grant select on public.v_tenant_responses_full to service_role;

-- Handshake action types (seed data isn't emitted by db diff).
insert into public.activity_action_types (code, label) values
  ('tenant_transfer_proposed', 'Transfer proposed'),
  ('tenant_transfer_rejected', 'Transfer rejected'),
  ('tenant_transfer_cancelled', 'Transfer cancelled')
on conflict (code) do nothing;


