-- Groups the per-tenant billing rows that belong to one logical period of a
-- property (bed-space "unified" billing). Was billing_entries.period_id (a bare uuid).
create table public.billing_periods (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  sequence integer not null,
  due_date date not null,
  created_at timestamptz not null default now()
);

create index idx_billing_periods_property on public.billing_periods (property_id);

-- One invoice per lease per period. Derived figures (other_charges, gross_due,
-- paid_amount, balance) are NOT stored here — see public.v_billing_entries_full.
create table public.billing_entries (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete cascade,
  period_id uuid references public.billing_periods(id) on delete set null,
  due_date date not null,
  rent_due numeric(12, 2) not null default 0,
  status_code text not null default 'Not Yet Due' references public.billing_statuses(code),
  sequence integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_billing_entries_lease on public.billing_entries (lease_id);
create index idx_billing_entries_period on public.billing_entries (period_id);

-- Was billing_entries.expense_items (a JSON array). other_charges = SUM(amount).
create table public.billing_charges (
  id uuid primary key default gen_random_uuid(),
  billing_entry_id uuid not null references public.billing_entries(id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index idx_billing_charges_entry on public.billing_charges (billing_entry_id);

-- Per-edit audit trail. update_billing_entry_atomic snapshots the resulting
-- rent_due + charge lines + status and the editing landlord on every edit, so an
-- invoice's full revision history is durable and queryable. charges is a genuine
-- point-in-time document (the lines as they stood), hence jsonb not a relation.
create table public.billing_entry_revisions (
  id uuid primary key default gen_random_uuid(),
  billing_entry_id uuid not null references public.billing_entries(id) on delete cascade,
  rent_due numeric(12, 2) not null,
  charges jsonb not null default '[]'::jsonb,
  status_code text not null references public.billing_statuses(code),
  edited_by uuid references public.profiles(id) on delete set null,
  edited_at timestamptz not null default now()
);

create index idx_billing_entry_revisions_entry
  on public.billing_entry_revisions (billing_entry_id, edited_at desc);

-- Payments ledger. Replaces the single paid_amount column and the tenant.overflow
-- field with one row per payment, so paid amount and credit become derived sums.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  billing_entry_id uuid references public.billing_entries(id) on delete set null,
  lease_id uuid not null references public.leases(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payment_type_code text not null default 'rent' references public.payment_types(code),
  amount numeric(12, 2) not null check (amount <> 0),
  paid_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_payments_entry on public.payments (billing_entry_id);
create index idx_payments_lease on public.payments (lease_id);

-- Replaces billing_entries.last_reminded_at; keeps full reminder history and
-- makes the "once per day" rule a simple existence check.
create table public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  billing_entry_id uuid not null references public.billing_entries(id) on delete cascade,
  channel text not null default 'sms',
  status text not null default 'sent',
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_reminder_logs_entry on public.reminder_logs (billing_entry_id, sent_at);
