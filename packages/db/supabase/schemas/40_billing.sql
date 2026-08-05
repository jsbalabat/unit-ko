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
-- paid_amount, balance, status_code) are NOT stored here — see
-- public.v_billing_entries_full.
create table public.billing_entries (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id) on delete cascade,
  period_id uuid references public.billing_periods(id) on delete set null,
  due_date date not null,
  rent_due numeric(12, 2) not null default 0,
  sequence integer not null default 1,
  -- Soft-mark set when this invoice's open balance is carried onto a new lease in a
  -- tenant transfer: the row stays for audit but drops out of the property's live
  -- ledger (balance 0, status 'Transferred'). null = active.
  transferred_at timestamptz,
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
  -- true when this allocation cascaded in from an overpayment on a different
  -- invoice (the waterfall) rather than the invoice the landlord targeted; a
  -- recording-time fact, so the invoice history can flag it.
  is_overflow boolean not null default false,
  -- Groups the allocations of one recorded payment (the targeted invoice, any
  -- waterfall overflow, and the surplus credit share a batch), so reversing a
  -- payment voids the whole thing atomically instead of a single stray row.
  batch_id uuid not null default gen_random_uuid(),
  -- Soft void: a reversed payment stays in the ledger for audit but drops out of
  -- every derived sum (paid_amount, credit), so balances and status recompute on
  -- their own. null = active.
  voided_at timestamptz,
  voided_by uuid references public.profiles(id) on delete set null,
  void_reason text,
  created_at timestamptz not null default now()
);

create index idx_payments_entry on public.payments (billing_entry_id);
create index idx_payments_lease on public.payments (lease_id);
create index idx_payments_batch on public.payments (batch_id);

-- One row per reminder dispatch attempt (replaces billing_entries.last_reminded_at).
-- status_code walks pending → sent | failed as the dispatcher fires the webhook and
-- records the true outcome: created_at is the claim time, sent_at is set only once a
-- send is accepted, delivered_at is set later by the optional delivery callback.
create table public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  billing_entry_id uuid not null references public.billing_entries(id) on delete cascade,
  channel_code text not null default 'email' references public.reminder_channels(code),
  status_code text not null default 'pending' references public.reminder_statuses(code),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz
);

create index idx_reminder_logs_entry on public.reminder_logs (billing_entry_id, created_at);

-- A tenant's response to a specific bill (acknowledge / will pay / already paid /
-- dispute) with an optional note. The landlord reviews these and stamps
-- confirmed_at/confirmed_by once seen — a lightweight two-step handshake, not a
-- payment (money still flows only through the payments ledger).
create table public.tenant_responses (
  id uuid primary key default gen_random_uuid(),
  billing_entry_id uuid not null references public.billing_entries(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  response_type_code text not null references public.tenant_response_types(code),
  note text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id)
);

create index idx_tenant_responses_entry on public.tenant_responses (billing_entry_id, created_at);
