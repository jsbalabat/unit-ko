drop view if exists "public"."v_archived_tenants";

drop view if exists "public"."v_lease_credit";

drop view if exists "public"."v_property_occupancy";

drop view if exists "public"."v_reminder_logs_full";

drop view if exists "public"."v_tenant_responses_full";

drop view if exists "public"."v_billing_entries_full";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_transfer_request_atomic(p_landlord_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_tenant_id uuid := nullif(p_payload->>'tenantId', '')::uuid;
  v_to_property_id uuid := nullif(p_payload->>'toPropertyId', '')::uuid;
  v_from_lease public.leases%rowtype;
  v_from_property_id uuid;
  v_to_owner uuid;
  v_request_id uuid;
begin
  if p_landlord_id is null then raise exception 'landlord id is required'; end if;
  if v_tenant_id is null then raise exception 'tenantId is required'; end if;
  if v_to_property_id is null then raise exception 'toPropertyId is required'; end if;

  perform 1 from public.tenants
  where id = v_tenant_id and landlord_id = p_landlord_id;
  if not found then raise exception 'tenant not found'; end if;

  select * into v_from_lease from public.leases
  where tenant_id = v_tenant_id and status = 'active';
  if not found then raise exception 'tenant has no active lease to transfer'; end if;
  v_from_property_id := v_from_lease.property_id;

  if v_from_property_id = v_to_property_id then
    raise exception 'tenant is already on this property';
  end if;

  select landlord_id into v_to_owner from public.properties
  where id = v_to_property_id;
  if not found then raise exception 'destination property not found'; end if;
  if v_to_owner is distinct from p_landlord_id then
    raise exception 'destination property not owned by landlord';
  end if;

  if exists (
    select 1 from public.tenant_transfer_requests
    where tenant_id = v_tenant_id and status = 'pending'
  ) then
    raise exception 'a transfer is already pending for this tenant';
  end if;

  insert into public.tenant_transfer_requests (
    tenant_id, from_property_id, from_lease_id, to_property_id, status, created_by
  ) values (
    v_tenant_id, v_from_property_id, v_from_lease.id, v_to_property_id, 'pending', p_landlord_id
  )
  returning id into v_request_id;

  return jsonb_build_object(
    'requestId', v_request_id,
    'tenantId', v_tenant_id,
    'fromPropertyId', v_from_property_id,
    'toPropertyId', v_to_property_id,
    'fromLeaseId', v_from_lease.id,
    'status', 'pending'
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_transfer_request_atomic(p_tenant_id uuid, p_request_id uuid, p_confirm boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_request public.tenant_transfer_requests%rowtype;
  v_landlord_id uuid;
  v_transfer jsonb := null;
  v_new_status text;
begin
  if p_tenant_id is null then raise exception 'tenant id is required'; end if;
  if p_request_id is null then raise exception 'request id is required'; end if;

  select * into v_request from public.tenant_transfer_requests
  where id = p_request_id for update;
  if not found or v_request.tenant_id is distinct from p_tenant_id then
    raise exception 'transfer request not found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'transfer request already resolved';
  end if;

  if p_confirm then
    -- The proposal snapshot must still hold: the source lease is the tenant's current
    -- active one. If it changed, refuse rather than move under different conditions.
    if not exists (
      select 1 from public.leases
      where id = v_request.from_lease_id and tenant_id = p_tenant_id and status = 'active'
    ) then
      raise exception 'the tenant''s lease changed since this transfer was proposed';
    end if;

    select landlord_id into v_landlord_id from public.tenants where id = p_tenant_id;
    v_transfer := public.transfer_tenant_atomic(
      v_landlord_id,
      jsonb_build_object('tenantId', p_tenant_id, 'toPropertyId', v_request.to_property_id)
    );
    v_new_status := 'confirmed';
  else
    v_new_status := 'rejected';
  end if;

  update public.tenant_transfer_requests
  set status = v_new_status, resolved_at = now()
  where id = p_request_id;

  return jsonb_build_object(
    'requestId', p_request_id,
    'tenantId', p_tenant_id,
    'status', v_new_status,
    'fromPropertyId', v_request.from_property_id,
    'toPropertyId', v_request.to_property_id,
    'transfer', v_transfer
  );
end;
$function$
;

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


-- === hand-appended: db diff strips grants ===

-- New functions are left PUBLIC-executable; lock them to service_role.
revoke execute on function public.create_transfer_request_atomic(uuid, jsonb) from public;
grant execute on function public.create_transfer_request_atomic(uuid, jsonb) to service_role;
revoke execute on function public.resolve_transfer_request_atomic(uuid, uuid, boolean) from public;
grant execute on function public.resolve_transfer_request_atomic(uuid, uuid, boolean) to service_role;

-- The functions reference v_billing_entries_full, so migra recreated the whole view
-- chain and wiped their grants. Restore SELECT for the service-role API.
grant select on public.v_billing_entries_full to service_role;
grant select on public.v_lease_credit to service_role;
grant select on public.v_archived_tenants to service_role;
grant select on public.v_property_occupancy to service_role;
grant select on public.v_reminder_logs_full to service_role;
grant select on public.v_tenant_responses_full to service_role;



