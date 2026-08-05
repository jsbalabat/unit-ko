-- Tenant identity only. Lease terms and accounting moved to public.leases.
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,  -- null = unhoused
  tenant_name text not null,
  email citext,
  contact_number text not null,
  tenant_slot integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tenants_landlord on public.tenants (landlord_id);
create index idx_tenants_property on public.tenants (property_id);

-- A lease is a first-class, historical record of one tenant occupying one
-- property under specific terms. Ending a lease (status='ended') replaces the
-- old "snapshot into archived_tenants + delete the tenant" flow, keeping the
-- full history relationally.
create table public.leases (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  billing_frequency_code text not null default 'monthly' references public.billing_frequencies(code),
  contract_periods integer,                            -- was contract_months
  rent_amount numeric(12, 2) not null default 0,       -- was rent_per_person
  rent_start_date date,
  rent_end_date date,
  due_day smallint check (due_day between 1 and 31),   -- was a free-text string
  advance_payment numeric(12, 2) not null default 0,
  security_deposit numeric(12, 2) not null default 0,
  status text not null default 'active' check (status in ('active', 'ended')),
  end_reason text,
  ended_at timestamptz,
  -- Set on the source lease when a tenant is transferred to another unit: points at
  -- the new active lease, so the move is auditable A -> B. null = not transferred.
  transferred_to_lease_id uuid references public.leases(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_leases_property on public.leases (property_id);
create index idx_leases_tenant on public.leases (tenant_id);
-- At most one active lease per tenant.
create unique index uq_active_lease_per_tenant on public.leases (tenant_id) where status = 'active';

-- A landlord-initiated tenant transfer awaiting the tenant's confirmation. The move
-- itself (transfer_tenant_atomic) only runs once the tenant confirms; a rejection or
-- a landlord cancellation leaves everything unchanged. from_property/from_lease are
-- snapshotted at proposal time for the audit trail. At most one open request per
-- tenant (the partial unique index).
create table public.tenant_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  from_property_id uuid references public.properties(id) on delete set null,
  from_lease_id uuid references public.leases(id) on delete set null,
  to_property_id uuid not null references public.properties(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_transfer_requests_tenant on public.tenant_transfer_requests (tenant_id);
create unique index uq_pending_transfer_per_tenant
  on public.tenant_transfer_requests (tenant_id) where status = 'pending';
