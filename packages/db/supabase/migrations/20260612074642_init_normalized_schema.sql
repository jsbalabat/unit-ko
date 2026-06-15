create extension if not exists "citext" with schema "public";


  create table "public"."activity_action_types" (
    "code" text not null,
    "label" text not null
      );


alter table "public"."activity_action_types" enable row level security;


  create table "public"."activity_logs" (
    "id" uuid not null default gen_random_uuid(),
    "property_id" uuid,
    "tenant_id" uuid,
    "lease_id" uuid,
    "user_id" uuid,
    "action_type_code" text not null,
    "description" text not null,
    "metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."activity_logs" enable row level security;


  create table "public"."amenities" (
    "code" text not null,
    "label" text not null
      );


alter table "public"."amenities" enable row level security;


  create table "public"."billing_charges" (
    "id" uuid not null default gen_random_uuid(),
    "billing_entry_id" uuid not null,
    "name" text not null,
    "amount" numeric(12,2) not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."billing_charges" enable row level security;


  create table "public"."billing_entries" (
    "id" uuid not null default gen_random_uuid(),
    "lease_id" uuid not null,
    "period_id" uuid,
    "due_date" date not null,
    "rent_due" numeric(12,2) not null default 0,
    "status_code" text not null default 'Not Yet Due'::text,
    "sequence" integer not null default 1,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."billing_entries" enable row level security;


  create table "public"."billing_frequencies" (
    "code" text not null,
    "label" text not null,
    "interval_days" integer not null
      );


alter table "public"."billing_frequencies" enable row level security;


  create table "public"."billing_periods" (
    "id" uuid not null default gen_random_uuid(),
    "property_id" uuid not null,
    "sequence" integer not null,
    "due_date" date not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."billing_periods" enable row level security;


  create table "public"."billing_statuses" (
    "code" text not null,
    "label" text not null,
    "sort_order" integer not null default 0,
    "is_settled" boolean not null default false
      );


alter table "public"."billing_statuses" enable row level security;


  create table "public"."landlord_payout_methods" (
    "id" uuid not null default gen_random_uuid(),
    "landlord_id" uuid not null,
    "method" text not null,
    "account_name" text,
    "account_number" text,
    "details" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."landlord_payout_methods" enable row level security;


  create table "public"."leases" (
    "id" uuid not null default gen_random_uuid(),
    "property_id" uuid not null,
    "tenant_id" uuid not null,
    "billing_frequency_code" text not null default 'monthly'::text,
    "contract_periods" integer,
    "rent_amount" numeric(12,2) not null default 0,
    "rent_start_date" date,
    "rent_end_date" date,
    "due_day" smallint,
    "advance_payment" numeric(12,2) not null default 0,
    "security_deposit" numeric(12,2) not null default 0,
    "status" text not null default 'active'::text,
    "end_reason" text,
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."leases" enable row level security;


  create table "public"."payment_types" (
    "code" text not null,
    "label" text not null
      );


alter table "public"."payment_types" enable row level security;


  create table "public"."payments" (
    "id" uuid not null default gen_random_uuid(),
    "billing_entry_id" uuid,
    "lease_id" uuid not null,
    "tenant_id" uuid not null,
    "payment_type_code" text not null default 'rent'::text,
    "amount" numeric(12,2) not null,
    "paid_at" timestamp with time zone not null default now(),
    "recorded_by" uuid,
    "notes" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."payments" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "email" public.citext not null,
    "full_name" text,
    "username" text,
    "phone" text,
    "role" text not null default 'landlord'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."profiles" enable row level security;


  create table "public"."properties" (
    "id" uuid not null default gen_random_uuid(),
    "landlord_id" uuid not null,
    "unit_name" text not null,
    "property_type_code" text,
    "property_location" text,
    "rent_amount" numeric(12,2) not null default 0,
    "max_tenants" integer not null default 1,
    "billing_mode" text not null default 'unified'::text,
    "lease_date" date,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."properties" enable row level security;


  create table "public"."property_amenities" (
    "property_id" uuid not null,
    "amenity_code" text not null
      );


alter table "public"."property_amenities" enable row level security;


  create table "public"."property_notes" (
    "id" uuid not null default gen_random_uuid(),
    "property_id" uuid not null,
    "author_id" uuid,
    "body" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."property_notes" enable row level security;


  create table "public"."property_types" (
    "code" text not null,
    "label" text not null
      );


alter table "public"."property_types" enable row level security;


  create table "public"."reminder_logs" (
    "id" uuid not null default gen_random_uuid(),
    "billing_entry_id" uuid not null,
    "channel" text not null default 'sms'::text,
    "status" text not null default 'sent'::text,
    "sent_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."reminder_logs" enable row level security;


  create table "public"."subscription_plans" (
    "code" text not null,
    "name" text not null,
    "property_limit" integer not null,
    "price" numeric(12,2) not null default 0
      );


alter table "public"."subscription_plans" enable row level security;


  create table "public"."subscription_statuses" (
    "code" text not null,
    "label" text not null
      );


alter table "public"."subscription_statuses" enable row level security;


  create table "public"."subscriptions" (
    "id" uuid not null default gen_random_uuid(),
    "landlord_id" uuid not null,
    "plan_code" text not null,
    "status_code" text not null default 'active'::text,
    "started_at" timestamp with time zone not null default now(),
    "ends_at" timestamp with time zone,
    "last_payment_at" timestamp with time zone,
    "next_billing_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."subscriptions" enable row level security;


  create table "public"."tenants" (
    "id" uuid not null default gen_random_uuid(),
    "landlord_id" uuid not null,
    "property_id" uuid,
    "tenant_name" text not null,
    "email" public.citext,
    "contact_number" text not null,
    "tenant_slot" integer,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."tenants" enable row level security;

CREATE UNIQUE INDEX activity_action_types_pkey ON public.activity_action_types USING btree (code);

CREATE UNIQUE INDEX activity_logs_pkey ON public.activity_logs USING btree (id);

CREATE UNIQUE INDEX amenities_pkey ON public.amenities USING btree (code);

CREATE UNIQUE INDEX billing_charges_pkey ON public.billing_charges USING btree (id);

CREATE UNIQUE INDEX billing_entries_pkey ON public.billing_entries USING btree (id);

CREATE UNIQUE INDEX billing_frequencies_pkey ON public.billing_frequencies USING btree (code);

CREATE UNIQUE INDEX billing_periods_pkey ON public.billing_periods USING btree (id);

CREATE UNIQUE INDEX billing_statuses_pkey ON public.billing_statuses USING btree (code);

CREATE INDEX idx_activity_logs_created ON public.activity_logs USING btree (created_at DESC);

CREATE INDEX idx_activity_logs_property ON public.activity_logs USING btree (property_id);

CREATE INDEX idx_billing_charges_entry ON public.billing_charges USING btree (billing_entry_id);

CREATE INDEX idx_billing_entries_lease ON public.billing_entries USING btree (lease_id);

CREATE INDEX idx_billing_entries_period ON public.billing_entries USING btree (period_id);

CREATE INDEX idx_billing_periods_property ON public.billing_periods USING btree (property_id);

CREATE INDEX idx_leases_property ON public.leases USING btree (property_id);

CREATE INDEX idx_leases_tenant ON public.leases USING btree (tenant_id);

CREATE INDEX idx_payments_entry ON public.payments USING btree (billing_entry_id);

CREATE INDEX idx_payments_lease ON public.payments USING btree (lease_id);

CREATE INDEX idx_profiles_email ON public.profiles USING btree (email);

CREATE INDEX idx_properties_landlord ON public.properties USING btree (landlord_id);

CREATE INDEX idx_property_notes_property ON public.property_notes USING btree (property_id);

CREATE INDEX idx_reminder_logs_entry ON public.reminder_logs USING btree (billing_entry_id, sent_at);

CREATE INDEX idx_tenants_landlord ON public.tenants USING btree (landlord_id);

CREATE INDEX idx_tenants_property ON public.tenants USING btree (property_id);

CREATE UNIQUE INDEX landlord_payout_methods_landlord_id_method_key ON public.landlord_payout_methods USING btree (landlord_id, method);

CREATE UNIQUE INDEX landlord_payout_methods_pkey ON public.landlord_payout_methods USING btree (id);

CREATE UNIQUE INDEX leases_pkey ON public.leases USING btree (id);

CREATE UNIQUE INDEX payment_types_pkey ON public.payment_types USING btree (code);

CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (id);

CREATE UNIQUE INDEX profiles_email_key ON public.profiles USING btree (email);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX properties_pkey ON public.properties USING btree (id);

CREATE UNIQUE INDEX property_amenities_pkey ON public.property_amenities USING btree (property_id, amenity_code);

CREATE UNIQUE INDEX property_notes_pkey ON public.property_notes USING btree (id);

CREATE UNIQUE INDEX property_types_pkey ON public.property_types USING btree (code);

CREATE UNIQUE INDEX reminder_logs_pkey ON public.reminder_logs USING btree (id);

CREATE UNIQUE INDEX subscription_plans_pkey ON public.subscription_plans USING btree (code);

CREATE UNIQUE INDEX subscription_statuses_pkey ON public.subscription_statuses USING btree (code);

CREATE UNIQUE INDEX subscriptions_landlord_id_key ON public.subscriptions USING btree (landlord_id);

CREATE UNIQUE INDEX subscriptions_pkey ON public.subscriptions USING btree (id);

CREATE UNIQUE INDEX tenants_pkey ON public.tenants USING btree (id);

CREATE UNIQUE INDEX uq_active_lease_per_tenant ON public.leases USING btree (tenant_id) WHERE (status = 'active'::text);

alter table "public"."activity_action_types" add constraint "activity_action_types_pkey" PRIMARY KEY using index "activity_action_types_pkey";

alter table "public"."activity_logs" add constraint "activity_logs_pkey" PRIMARY KEY using index "activity_logs_pkey";

alter table "public"."amenities" add constraint "amenities_pkey" PRIMARY KEY using index "amenities_pkey";

alter table "public"."billing_charges" add constraint "billing_charges_pkey" PRIMARY KEY using index "billing_charges_pkey";

alter table "public"."billing_entries" add constraint "billing_entries_pkey" PRIMARY KEY using index "billing_entries_pkey";

alter table "public"."billing_frequencies" add constraint "billing_frequencies_pkey" PRIMARY KEY using index "billing_frequencies_pkey";

alter table "public"."billing_periods" add constraint "billing_periods_pkey" PRIMARY KEY using index "billing_periods_pkey";

alter table "public"."billing_statuses" add constraint "billing_statuses_pkey" PRIMARY KEY using index "billing_statuses_pkey";

alter table "public"."landlord_payout_methods" add constraint "landlord_payout_methods_pkey" PRIMARY KEY using index "landlord_payout_methods_pkey";

alter table "public"."leases" add constraint "leases_pkey" PRIMARY KEY using index "leases_pkey";

alter table "public"."payment_types" add constraint "payment_types_pkey" PRIMARY KEY using index "payment_types_pkey";

alter table "public"."payments" add constraint "payments_pkey" PRIMARY KEY using index "payments_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."properties" add constraint "properties_pkey" PRIMARY KEY using index "properties_pkey";

alter table "public"."property_amenities" add constraint "property_amenities_pkey" PRIMARY KEY using index "property_amenities_pkey";

alter table "public"."property_notes" add constraint "property_notes_pkey" PRIMARY KEY using index "property_notes_pkey";

alter table "public"."property_types" add constraint "property_types_pkey" PRIMARY KEY using index "property_types_pkey";

alter table "public"."reminder_logs" add constraint "reminder_logs_pkey" PRIMARY KEY using index "reminder_logs_pkey";

alter table "public"."subscription_plans" add constraint "subscription_plans_pkey" PRIMARY KEY using index "subscription_plans_pkey";

alter table "public"."subscription_statuses" add constraint "subscription_statuses_pkey" PRIMARY KEY using index "subscription_statuses_pkey";

alter table "public"."subscriptions" add constraint "subscriptions_pkey" PRIMARY KEY using index "subscriptions_pkey";

alter table "public"."tenants" add constraint "tenants_pkey" PRIMARY KEY using index "tenants_pkey";

alter table "public"."activity_logs" add constraint "activity_logs_action_type_code_fkey" FOREIGN KEY (action_type_code) REFERENCES public.activity_action_types(code) not valid;

alter table "public"."activity_logs" validate constraint "activity_logs_action_type_code_fkey";

alter table "public"."activity_logs" add constraint "activity_logs_lease_id_fkey" FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE SET NULL not valid;

alter table "public"."activity_logs" validate constraint "activity_logs_lease_id_fkey";

alter table "public"."activity_logs" add constraint "activity_logs_property_id_fkey" FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE not valid;

alter table "public"."activity_logs" validate constraint "activity_logs_property_id_fkey";

alter table "public"."activity_logs" add constraint "activity_logs_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL not valid;

alter table "public"."activity_logs" validate constraint "activity_logs_tenant_id_fkey";

alter table "public"."activity_logs" add constraint "activity_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."activity_logs" validate constraint "activity_logs_user_id_fkey";

alter table "public"."billing_charges" add constraint "billing_charges_billing_entry_id_fkey" FOREIGN KEY (billing_entry_id) REFERENCES public.billing_entries(id) ON DELETE CASCADE not valid;

alter table "public"."billing_charges" validate constraint "billing_charges_billing_entry_id_fkey";

alter table "public"."billing_entries" add constraint "billing_entries_lease_id_fkey" FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE not valid;

alter table "public"."billing_entries" validate constraint "billing_entries_lease_id_fkey";

alter table "public"."billing_entries" add constraint "billing_entries_period_id_fkey" FOREIGN KEY (period_id) REFERENCES public.billing_periods(id) ON DELETE SET NULL not valid;

alter table "public"."billing_entries" validate constraint "billing_entries_period_id_fkey";

alter table "public"."billing_entries" add constraint "billing_entries_status_code_fkey" FOREIGN KEY (status_code) REFERENCES public.billing_statuses(code) not valid;

alter table "public"."billing_entries" validate constraint "billing_entries_status_code_fkey";

alter table "public"."billing_periods" add constraint "billing_periods_property_id_fkey" FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE not valid;

alter table "public"."billing_periods" validate constraint "billing_periods_property_id_fkey";

alter table "public"."landlord_payout_methods" add constraint "landlord_payout_methods_landlord_id_fkey" FOREIGN KEY (landlord_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."landlord_payout_methods" validate constraint "landlord_payout_methods_landlord_id_fkey";

alter table "public"."landlord_payout_methods" add constraint "landlord_payout_methods_landlord_id_method_key" UNIQUE using index "landlord_payout_methods_landlord_id_method_key";

alter table "public"."landlord_payout_methods" add constraint "landlord_payout_methods_method_check" CHECK ((method = ANY (ARRAY['bank'::text, 'gcash'::text, 'paymaya'::text, 'other'::text]))) not valid;

alter table "public"."landlord_payout_methods" validate constraint "landlord_payout_methods_method_check";

alter table "public"."leases" add constraint "leases_billing_frequency_code_fkey" FOREIGN KEY (billing_frequency_code) REFERENCES public.billing_frequencies(code) not valid;

alter table "public"."leases" validate constraint "leases_billing_frequency_code_fkey";

alter table "public"."leases" add constraint "leases_due_day_check" CHECK (((due_day >= 1) AND (due_day <= 31))) not valid;

alter table "public"."leases" validate constraint "leases_due_day_check";

alter table "public"."leases" add constraint "leases_property_id_fkey" FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE not valid;

alter table "public"."leases" validate constraint "leases_property_id_fkey";

alter table "public"."leases" add constraint "leases_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'ended'::text]))) not valid;

alter table "public"."leases" validate constraint "leases_status_check";

alter table "public"."leases" add constraint "leases_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE not valid;

alter table "public"."leases" validate constraint "leases_tenant_id_fkey";

alter table "public"."payments" add constraint "payments_amount_check" CHECK ((amount <> (0)::numeric)) not valid;

alter table "public"."payments" validate constraint "payments_amount_check";

alter table "public"."payments" add constraint "payments_billing_entry_id_fkey" FOREIGN KEY (billing_entry_id) REFERENCES public.billing_entries(id) ON DELETE SET NULL not valid;

alter table "public"."payments" validate constraint "payments_billing_entry_id_fkey";

alter table "public"."payments" add constraint "payments_lease_id_fkey" FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE not valid;

alter table "public"."payments" validate constraint "payments_lease_id_fkey";

alter table "public"."payments" add constraint "payments_payment_type_code_fkey" FOREIGN KEY (payment_type_code) REFERENCES public.payment_types(code) not valid;

alter table "public"."payments" validate constraint "payments_payment_type_code_fkey";

alter table "public"."payments" add constraint "payments_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."payments" validate constraint "payments_recorded_by_fkey";

alter table "public"."payments" add constraint "payments_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE not valid;

alter table "public"."payments" validate constraint "payments_tenant_id_fkey";

alter table "public"."profiles" add constraint "profiles_email_key" UNIQUE using index "profiles_email_key";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['landlord'::text, 'tenant'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_role_check";

alter table "public"."properties" add constraint "properties_billing_mode_check" CHECK ((billing_mode = ANY (ARRAY['unified'::text, 'per_tenant'::text]))) not valid;

alter table "public"."properties" validate constraint "properties_billing_mode_check";

alter table "public"."properties" add constraint "properties_landlord_id_fkey" FOREIGN KEY (landlord_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."properties" validate constraint "properties_landlord_id_fkey";

alter table "public"."properties" add constraint "properties_max_tenants_check" CHECK ((max_tenants >= 1)) not valid;

alter table "public"."properties" validate constraint "properties_max_tenants_check";

alter table "public"."properties" add constraint "properties_property_type_code_fkey" FOREIGN KEY (property_type_code) REFERENCES public.property_types(code) not valid;

alter table "public"."properties" validate constraint "properties_property_type_code_fkey";

alter table "public"."property_amenities" add constraint "property_amenities_amenity_code_fkey" FOREIGN KEY (amenity_code) REFERENCES public.amenities(code) ON DELETE CASCADE not valid;

alter table "public"."property_amenities" validate constraint "property_amenities_amenity_code_fkey";

alter table "public"."property_amenities" add constraint "property_amenities_property_id_fkey" FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE not valid;

alter table "public"."property_amenities" validate constraint "property_amenities_property_id_fkey";

alter table "public"."property_notes" add constraint "property_notes_author_id_fkey" FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."property_notes" validate constraint "property_notes_author_id_fkey";

alter table "public"."property_notes" add constraint "property_notes_property_id_fkey" FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE not valid;

alter table "public"."property_notes" validate constraint "property_notes_property_id_fkey";

alter table "public"."reminder_logs" add constraint "reminder_logs_billing_entry_id_fkey" FOREIGN KEY (billing_entry_id) REFERENCES public.billing_entries(id) ON DELETE CASCADE not valid;

alter table "public"."reminder_logs" validate constraint "reminder_logs_billing_entry_id_fkey";

alter table "public"."subscriptions" add constraint "subscriptions_landlord_id_fkey" FOREIGN KEY (landlord_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_landlord_id_fkey";

alter table "public"."subscriptions" add constraint "subscriptions_landlord_id_key" UNIQUE using index "subscriptions_landlord_id_key";

alter table "public"."subscriptions" add constraint "subscriptions_plan_code_fkey" FOREIGN KEY (plan_code) REFERENCES public.subscription_plans(code) not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_plan_code_fkey";

alter table "public"."subscriptions" add constraint "subscriptions_status_code_fkey" FOREIGN KEY (status_code) REFERENCES public.subscription_statuses(code) not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_status_code_fkey";

alter table "public"."tenants" add constraint "tenants_landlord_id_fkey" FOREIGN KEY (landlord_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."tenants" validate constraint "tenants_landlord_id_fkey";

alter table "public"."tenants" add constraint "tenants_property_id_fkey" FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL not valid;

alter table "public"."tenants" validate constraint "tenants_property_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_landlord_payout_methods(p_property_id uuid)
 RETURNS TABLE(method text, account_name text, account_number text, details text, landlord_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_landlord uuid;
begin
  select landlord_id into v_landlord from public.properties where id = p_property_id;
  if v_landlord is null then
    return;
  end if;

  return query
    select m.method, m.account_name, m.account_number, m.details, pr.full_name
    from public.landlord_payout_methods m
    join public.profiles pr on pr.id = m.landlord_id
    where m.landlord_id = v_landlord;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'landlord')
  on conflict (id) do nothing;
  return new;
exception
  when others then
    raise warning 'Failed to create profile for user %: %', new.id, sqlerrm;
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
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
          GROUP BY payments.lease_id) pay ON ((pay.lease_id = l.id)))
  WHERE (l.status = 'ended'::text);


create or replace view "public"."v_billing_entries_full" as  SELECT be.id,
    be.lease_id,
    be.period_id,
    be.due_date,
    be.rent_due,
    be.status_code,
    be.sequence,
    be.created_at,
    be.updated_at,
    COALESCE(c.other_charges, (0)::numeric) AS other_charges,
    (be.rent_due + COALESCE(c.other_charges, (0)::numeric)) AS gross_due,
    COALESCE(p.paid_amount, (0)::numeric) AS paid_amount,
    ((be.rent_due + COALESCE(c.other_charges, (0)::numeric)) - COALESCE(p.paid_amount, (0)::numeric)) AS balance
   FROM ((public.billing_entries be
     LEFT JOIN ( SELECT billing_charges.billing_entry_id,
            sum(billing_charges.amount) AS other_charges
           FROM public.billing_charges
          GROUP BY billing_charges.billing_entry_id) c ON ((c.billing_entry_id = be.id)))
     LEFT JOIN ( SELECT payments.billing_entry_id,
            sum(payments.amount) AS paid_amount
           FROM public.payments
          WHERE (payments.billing_entry_id IS NOT NULL)
          GROUP BY payments.billing_entry_id) p ON ((p.billing_entry_id = be.id)));


create or replace view "public"."v_property_occupancy" as  SELECT id AS property_id,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM public.leases l
              WHERE ((l.property_id = pr.id) AND (l.status = 'active'::text)))) THEN 'occupied'::text
            ELSE 'vacant'::text
        END AS occupancy_status
   FROM public.properties pr;


grant references on table "public"."activity_action_types" to "anon";

grant trigger on table "public"."activity_action_types" to "anon";

grant truncate on table "public"."activity_action_types" to "anon";

grant references on table "public"."activity_action_types" to "authenticated";

grant trigger on table "public"."activity_action_types" to "authenticated";

grant truncate on table "public"."activity_action_types" to "authenticated";

grant references on table "public"."activity_action_types" to "service_role";

grant trigger on table "public"."activity_action_types" to "service_role";

grant truncate on table "public"."activity_action_types" to "service_role";

grant references on table "public"."activity_logs" to "anon";

grant trigger on table "public"."activity_logs" to "anon";

grant truncate on table "public"."activity_logs" to "anon";

grant references on table "public"."activity_logs" to "authenticated";

grant trigger on table "public"."activity_logs" to "authenticated";

grant truncate on table "public"."activity_logs" to "authenticated";

grant references on table "public"."activity_logs" to "service_role";

grant trigger on table "public"."activity_logs" to "service_role";

grant truncate on table "public"."activity_logs" to "service_role";

grant references on table "public"."amenities" to "anon";

grant trigger on table "public"."amenities" to "anon";

grant truncate on table "public"."amenities" to "anon";

grant references on table "public"."amenities" to "authenticated";

grant trigger on table "public"."amenities" to "authenticated";

grant truncate on table "public"."amenities" to "authenticated";

grant references on table "public"."amenities" to "service_role";

grant trigger on table "public"."amenities" to "service_role";

grant truncate on table "public"."amenities" to "service_role";

grant references on table "public"."billing_charges" to "anon";

grant trigger on table "public"."billing_charges" to "anon";

grant truncate on table "public"."billing_charges" to "anon";

grant references on table "public"."billing_charges" to "authenticated";

grant trigger on table "public"."billing_charges" to "authenticated";

grant truncate on table "public"."billing_charges" to "authenticated";

grant references on table "public"."billing_charges" to "service_role";

grant trigger on table "public"."billing_charges" to "service_role";

grant truncate on table "public"."billing_charges" to "service_role";

grant references on table "public"."billing_entries" to "anon";

grant trigger on table "public"."billing_entries" to "anon";

grant truncate on table "public"."billing_entries" to "anon";

grant references on table "public"."billing_entries" to "authenticated";

grant trigger on table "public"."billing_entries" to "authenticated";

grant truncate on table "public"."billing_entries" to "authenticated";

grant references on table "public"."billing_entries" to "service_role";

grant trigger on table "public"."billing_entries" to "service_role";

grant truncate on table "public"."billing_entries" to "service_role";

grant references on table "public"."billing_frequencies" to "anon";

grant trigger on table "public"."billing_frequencies" to "anon";

grant truncate on table "public"."billing_frequencies" to "anon";

grant references on table "public"."billing_frequencies" to "authenticated";

grant trigger on table "public"."billing_frequencies" to "authenticated";

grant truncate on table "public"."billing_frequencies" to "authenticated";

grant references on table "public"."billing_frequencies" to "service_role";

grant trigger on table "public"."billing_frequencies" to "service_role";

grant truncate on table "public"."billing_frequencies" to "service_role";

grant references on table "public"."billing_periods" to "anon";

grant trigger on table "public"."billing_periods" to "anon";

grant truncate on table "public"."billing_periods" to "anon";

grant references on table "public"."billing_periods" to "authenticated";

grant trigger on table "public"."billing_periods" to "authenticated";

grant truncate on table "public"."billing_periods" to "authenticated";

grant references on table "public"."billing_periods" to "service_role";

grant trigger on table "public"."billing_periods" to "service_role";

grant truncate on table "public"."billing_periods" to "service_role";

grant references on table "public"."billing_statuses" to "anon";

grant trigger on table "public"."billing_statuses" to "anon";

grant truncate on table "public"."billing_statuses" to "anon";

grant references on table "public"."billing_statuses" to "authenticated";

grant trigger on table "public"."billing_statuses" to "authenticated";

grant truncate on table "public"."billing_statuses" to "authenticated";

grant references on table "public"."billing_statuses" to "service_role";

grant trigger on table "public"."billing_statuses" to "service_role";

grant truncate on table "public"."billing_statuses" to "service_role";

grant references on table "public"."landlord_payout_methods" to "anon";

grant trigger on table "public"."landlord_payout_methods" to "anon";

grant truncate on table "public"."landlord_payout_methods" to "anon";

grant references on table "public"."landlord_payout_methods" to "authenticated";

grant trigger on table "public"."landlord_payout_methods" to "authenticated";

grant truncate on table "public"."landlord_payout_methods" to "authenticated";

grant references on table "public"."landlord_payout_methods" to "service_role";

grant trigger on table "public"."landlord_payout_methods" to "service_role";

grant truncate on table "public"."landlord_payout_methods" to "service_role";

grant references on table "public"."leases" to "anon";

grant trigger on table "public"."leases" to "anon";

grant truncate on table "public"."leases" to "anon";

grant references on table "public"."leases" to "authenticated";

grant trigger on table "public"."leases" to "authenticated";

grant truncate on table "public"."leases" to "authenticated";

grant references on table "public"."leases" to "service_role";

grant trigger on table "public"."leases" to "service_role";

grant truncate on table "public"."leases" to "service_role";

grant references on table "public"."payment_types" to "anon";

grant trigger on table "public"."payment_types" to "anon";

grant truncate on table "public"."payment_types" to "anon";

grant references on table "public"."payment_types" to "authenticated";

grant trigger on table "public"."payment_types" to "authenticated";

grant truncate on table "public"."payment_types" to "authenticated";

grant references on table "public"."payment_types" to "service_role";

grant trigger on table "public"."payment_types" to "service_role";

grant truncate on table "public"."payment_types" to "service_role";

grant references on table "public"."payments" to "anon";

grant trigger on table "public"."payments" to "anon";

grant truncate on table "public"."payments" to "anon";

grant references on table "public"."payments" to "authenticated";

grant trigger on table "public"."payments" to "authenticated";

grant truncate on table "public"."payments" to "authenticated";

grant references on table "public"."payments" to "service_role";

grant trigger on table "public"."payments" to "service_role";

grant truncate on table "public"."payments" to "service_role";

grant references on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant references on table "public"."properties" to "anon";

grant trigger on table "public"."properties" to "anon";

grant truncate on table "public"."properties" to "anon";

grant references on table "public"."properties" to "authenticated";

grant trigger on table "public"."properties" to "authenticated";

grant truncate on table "public"."properties" to "authenticated";

grant references on table "public"."properties" to "service_role";

grant trigger on table "public"."properties" to "service_role";

grant truncate on table "public"."properties" to "service_role";

grant references on table "public"."property_amenities" to "anon";

grant trigger on table "public"."property_amenities" to "anon";

grant truncate on table "public"."property_amenities" to "anon";

grant references on table "public"."property_amenities" to "authenticated";

grant trigger on table "public"."property_amenities" to "authenticated";

grant truncate on table "public"."property_amenities" to "authenticated";

grant references on table "public"."property_amenities" to "service_role";

grant trigger on table "public"."property_amenities" to "service_role";

grant truncate on table "public"."property_amenities" to "service_role";

grant references on table "public"."property_notes" to "anon";

grant trigger on table "public"."property_notes" to "anon";

grant truncate on table "public"."property_notes" to "anon";

grant references on table "public"."property_notes" to "authenticated";

grant trigger on table "public"."property_notes" to "authenticated";

grant truncate on table "public"."property_notes" to "authenticated";

grant references on table "public"."property_notes" to "service_role";

grant trigger on table "public"."property_notes" to "service_role";

grant truncate on table "public"."property_notes" to "service_role";

grant references on table "public"."property_types" to "anon";

grant trigger on table "public"."property_types" to "anon";

grant truncate on table "public"."property_types" to "anon";

grant references on table "public"."property_types" to "authenticated";

grant trigger on table "public"."property_types" to "authenticated";

grant truncate on table "public"."property_types" to "authenticated";

grant references on table "public"."property_types" to "service_role";

grant trigger on table "public"."property_types" to "service_role";

grant truncate on table "public"."property_types" to "service_role";

grant references on table "public"."reminder_logs" to "anon";

grant trigger on table "public"."reminder_logs" to "anon";

grant truncate on table "public"."reminder_logs" to "anon";

grant references on table "public"."reminder_logs" to "authenticated";

grant trigger on table "public"."reminder_logs" to "authenticated";

grant truncate on table "public"."reminder_logs" to "authenticated";

grant references on table "public"."reminder_logs" to "service_role";

grant trigger on table "public"."reminder_logs" to "service_role";

grant truncate on table "public"."reminder_logs" to "service_role";

grant references on table "public"."subscription_plans" to "anon";

grant trigger on table "public"."subscription_plans" to "anon";

grant truncate on table "public"."subscription_plans" to "anon";

grant references on table "public"."subscription_plans" to "authenticated";

grant trigger on table "public"."subscription_plans" to "authenticated";

grant truncate on table "public"."subscription_plans" to "authenticated";

grant references on table "public"."subscription_plans" to "service_role";

grant trigger on table "public"."subscription_plans" to "service_role";

grant truncate on table "public"."subscription_plans" to "service_role";

grant references on table "public"."subscription_statuses" to "anon";

grant trigger on table "public"."subscription_statuses" to "anon";

grant truncate on table "public"."subscription_statuses" to "anon";

grant references on table "public"."subscription_statuses" to "authenticated";

grant trigger on table "public"."subscription_statuses" to "authenticated";

grant truncate on table "public"."subscription_statuses" to "authenticated";

grant references on table "public"."subscription_statuses" to "service_role";

grant trigger on table "public"."subscription_statuses" to "service_role";

grant truncate on table "public"."subscription_statuses" to "service_role";

grant references on table "public"."subscriptions" to "anon";

grant trigger on table "public"."subscriptions" to "anon";

grant truncate on table "public"."subscriptions" to "anon";

grant references on table "public"."subscriptions" to "authenticated";

grant trigger on table "public"."subscriptions" to "authenticated";

grant truncate on table "public"."subscriptions" to "authenticated";

grant references on table "public"."subscriptions" to "service_role";

grant trigger on table "public"."subscriptions" to "service_role";

grant truncate on table "public"."subscriptions" to "service_role";

grant references on table "public"."tenants" to "anon";

grant trigger on table "public"."tenants" to "anon";

grant truncate on table "public"."tenants" to "anon";

grant references on table "public"."tenants" to "authenticated";

grant trigger on table "public"."tenants" to "authenticated";

grant truncate on table "public"."tenants" to "authenticated";

grant references on table "public"."tenants" to "service_role";

grant trigger on table "public"."tenants" to "service_role";

grant truncate on table "public"."tenants" to "service_role";


  create policy "activity_action_types_read"
  on "public"."activity_action_types"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "amenities_read"
  on "public"."amenities"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "billing_frequencies_read"
  on "public"."billing_frequencies"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "billing_statuses_read"
  on "public"."billing_statuses"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "payment_types_read"
  on "public"."payment_types"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "property_types_read"
  on "public"."property_types"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "subscription_plans_read"
  on "public"."subscription_plans"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "subscription_statuses_read"
  on "public"."subscription_statuses"
  as permissive
  for select
  to anon, authenticated
using (true);


CREATE TRIGGER trg_billing_entries_updated_at BEFORE UPDATE ON public.billing_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_payout_methods_updated_at BEFORE UPDATE ON public.landlord_payout_methods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_leases_updated_at BEFORE UPDATE ON public.leases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_property_notes_updated_at BEFORE UPDATE ON public.property_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


