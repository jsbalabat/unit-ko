drop view if exists "public"."v_archived_tenants";

drop view if exists "public"."v_billing_entries_full";

drop view if exists "public"."v_reminder_logs_full";

alter table "public"."payments" add column "batch_id" uuid not null default gen_random_uuid();

alter table "public"."payments" add column "void_reason" text;

alter table "public"."payments" add column "voided_at" timestamp with time zone;

alter table "public"."payments" add column "voided_by" uuid;

CREATE INDEX idx_payments_batch ON public.payments USING btree (batch_id);

alter table "public"."payments" add constraint "payments_voided_by_fkey" FOREIGN KEY (voided_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."payments" validate constraint "payments_voided_by_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.void_payment_atomic(p_landlord_id uuid, p_batch_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_landlord_check uuid;
  v_lease_id uuid;
  v_tenant_id uuid;
  v_property_id uuid;
  v_voided_count integer;
  v_entry_ids uuid[];
begin
  if p_landlord_id is null then raise exception 'landlord id is required'; end if;
  if p_batch_id is null then raise exception 'batch id is required'; end if;

  -- Resolve + lock the batch's owner from any one of its rows.
  select p.lease_id, p.tenant_id, pr.id, pr.landlord_id
  into v_lease_id, v_tenant_id, v_property_id, v_landlord_check
  from public.payments p
  join public.leases l on l.id = p.lease_id
  join public.properties pr on pr.id = l.property_id
  where p.batch_id = p_batch_id
  order by p.created_at
  limit 1
  for update of p;
  if not found then raise exception 'payment not found'; end if;
  if v_landlord_check is distinct from p_landlord_id then
    raise exception 'not owned by landlord';
  end if;

  update public.payments set
    voided_at = now(),
    voided_by = p_landlord_id,
    void_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where batch_id = p_batch_id and voided_at is null;
  get diagnostics v_voided_count = row_count;
  if v_voided_count = 0 then raise exception 'payment already voided'; end if;

  select array_agg(distinct billing_entry_id)
  into v_entry_ids
  from public.payments
  where batch_id = p_batch_id and billing_entry_id is not null;

  return jsonb_build_object(
    'batchId', p_batch_id,
    'leaseId', v_lease_id,
    'tenantId', v_tenant_id,
    'propertyId', v_property_id,
    'voidedCount', v_voided_count,
    'entryIds', coalesce(to_jsonb(v_entry_ids), '[]'::jsonb)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_payment_atomic(p_landlord_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_billing_entry_id uuid := nullif(p_payload->>'billingEntryId', '')::uuid;
  v_lease_id uuid := nullif(p_payload->>'leaseId', '')::uuid;
  v_amount numeric := (p_payload->>'amount')::numeric;
  v_payment_type text := coalesce(nullif(p_payload->>'paymentType', ''), 'rent');
  v_paid_at timestamptz := coalesce(nullif(p_payload->>'paidAt', '')::timestamptz, now());
  v_notes text := nullif(p_payload->>'notes', '');
  v_tenant_id uuid;
  v_property_id uuid;
  v_landlord_check uuid;
  v_remaining numeric;
  v_apply numeric;
  v_ids uuid[];
  v_bals numeric[];
  v_i integer;
  v_pid uuid;
  v_first_payment_id uuid;
  v_first_entry_id uuid;
  v_applied_count integer := 0;
  v_credit numeric := 0;
  v_is_overflow boolean;
  v_primary_assigned boolean := false;
  -- One id for every allocation this call books, so a reversal can void the whole
  -- payment as a unit.
  v_batch_id uuid := gen_random_uuid();
begin
  if p_landlord_id is null then raise exception 'landlord id is required'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'amount must be positive'; end if;

  if v_billing_entry_id is not null then
    select l.id, l.tenant_id, p.id, p.landlord_id
    into v_lease_id, v_tenant_id, v_property_id, v_landlord_check
    from public.billing_entries be
    join public.leases l on l.id = be.lease_id
    join public.properties p on p.id = l.property_id
    where be.id = v_billing_entry_id;
    if not found then raise exception 'billing entry not found'; end if;
  elsif v_lease_id is not null then
    select l.tenant_id, p.id, p.landlord_id
    into v_tenant_id, v_property_id, v_landlord_check
    from public.leases l
    join public.properties p on p.id = l.property_id
    where l.id = v_lease_id;
    if not found then raise exception 'lease not found'; end if;
  else
    raise exception 'billingEntryId or leaseId is required';
  end if;

  if v_landlord_check is distinct from p_landlord_id then
    raise exception 'not owned by landlord';
  end if;

  -- Deposit/advance are lease-level ledger facts; they never reduce an invoice
  -- balance, so record a single unallocated row and return.
  if v_payment_type in ('deposit', 'advance') then
    insert into public.payments (
      billing_entry_id, lease_id, tenant_id, payment_type_code, amount, paid_at, recorded_by, notes, is_overflow, batch_id
    ) values (
      null, v_lease_id, v_tenant_id, v_payment_type, v_amount, v_paid_at, p_landlord_id, v_notes, false, v_batch_id
    )
    returning id into v_first_payment_id;
    return jsonb_build_object(
      'paymentId', v_first_payment_id, 'billingEntryId', null,
      'propertyId', v_property_id, 'appliedCount', 0, 'creditAmount', 0
    );
  end if;

  v_remaining := v_amount;

  -- Ordered claim list: the targeted invoice (ord 0) ahead of the lease's other
  -- unpaid invoices (ord 1), then oldest-first within each. The two array_aggs
  -- share one order expression so ids and balances stay paired.
  select
    array_agg(t.id order by t.ord, t.due_date asc nulls last, t.sequence asc nulls last, t.id),
    array_agg(t.balance order by t.ord, t.due_date asc nulls last, t.sequence asc nulls last, t.id)
  into v_ids, v_bals
  from (
    select id, balance, due_date, sequence,
      case when id = v_billing_entry_id then 0 else 1 end as ord
    from public.v_billing_entries_full
    where lease_id = v_lease_id and balance > 0
  ) t;

  if v_ids is not null then
    for v_i in 1 .. array_length(v_ids, 1) loop
      exit when v_remaining <= 0;
      v_apply := least(v_remaining, v_bals[v_i]);
      if v_apply <= 0 then continue; end if;

      -- An allocation is a waterfall overflow when it lands on an invoice other
      -- than the one the landlord targeted; with no explicit target, only the
      -- first (oldest) invoice is the primary and the rest overflow.
      if v_billing_entry_id is not null then
        v_is_overflow := v_ids[v_i] is distinct from v_billing_entry_id;
      else
        v_is_overflow := v_primary_assigned;
      end if;
      v_primary_assigned := true;

      insert into public.payments (
        billing_entry_id, lease_id, tenant_id, payment_type_code, amount, paid_at, recorded_by, notes, is_overflow, batch_id
      ) values (
        v_ids[v_i], v_lease_id, v_tenant_id, v_payment_type, v_apply, v_paid_at, p_landlord_id, v_notes, v_is_overflow, v_batch_id
      )
      returning id into v_pid;

      if v_first_payment_id is null then
        v_first_payment_id := v_pid;
        v_first_entry_id := v_ids[v_i];
      end if;

      v_applied_count := v_applied_count + 1;
      v_remaining := v_remaining - v_apply;
    end loop;
  end if;

  -- Surplus past every unpaid invoice becomes an unallocated lease-level credit
  -- rather than a negative invoice balance.
  if v_remaining > 0 then
    v_credit := v_remaining;
    insert into public.payments (
      billing_entry_id, lease_id, tenant_id, payment_type_code, amount, paid_at, recorded_by, notes, is_overflow, batch_id
    ) values (
      null, v_lease_id, v_tenant_id, v_payment_type, v_remaining, v_paid_at, p_landlord_id, v_notes, true, v_batch_id
    )
    returning id into v_pid;
    if v_first_payment_id is null then v_first_payment_id := v_pid; end if;
  end if;

  return jsonb_build_object(
    'paymentId', v_first_payment_id, 'billingEntryId', v_first_entry_id,
    'propertyId', v_property_id, 'appliedCount', v_applied_count, 'creditAmount', v_credit
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


create or replace view "public"."v_billing_entries_full" as  SELECT be.id,
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
    ((be.rent_due + COALESCE(c.other_charges, (0)::numeric)) - COALESCE(p.paid_amount, (0)::numeric)) AS balance,
    public.billing_entry_status((be.rent_due + COALESCE(c.other_charges, (0)::numeric)), COALESCE(p.paid_amount, (0)::numeric), ((be.rent_due + COALESCE(c.other_charges, (0)::numeric)) - COALESCE(p.paid_amount, (0)::numeric)), be.due_date) AS status_code
   FROM ((public.billing_entries be
     LEFT JOIN ( SELECT billing_charges.billing_entry_id,
            sum(billing_charges.amount) AS other_charges
           FROM public.billing_charges
          GROUP BY billing_charges.billing_entry_id) c ON ((c.billing_entry_id = be.id)))
     LEFT JOIN ( SELECT payments.billing_entry_id,
            sum(payments.amount) AS paid_amount
           FROM public.payments
          WHERE ((payments.billing_entry_id IS NOT NULL) AND (payments.voided_at IS NULL))
          GROUP BY payments.billing_entry_id) p ON ((p.billing_entry_id = be.id)));


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

-- void_payment_atomic is new, so db diff created it PUBLIC-executable and stripped
-- any grants. It trusts p_landlord_id, so lock it to the API role or an end-user
-- could void another landlord's payment by passing their id.
revoke execute on function public.void_payment_atomic(uuid, uuid, text) from public;
grant execute on function public.void_payment_atomic(uuid, uuid, text) to service_role;

-- Dropping a view drops its ACL, and db diff never re-emits grants. Re-grant the
-- API role read access on the views this migration recreated.
grant select on public.v_billing_entries_full to service_role;
grant select on public.v_archived_tenants to service_role;
grant select on public.v_reminder_logs_full to service_role;

-- The API writes this action on a reversal; seed it here too (data, not schema, so
-- db diff won't emit it) so the activity_logs FK holds on prod.
insert into public.activity_action_types (code, label) values
  ('payment_voided', 'Payment voided')
on conflict (code) do nothing;



