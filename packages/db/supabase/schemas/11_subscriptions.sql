-- One subscription per landlord (was a cluster of subscription_* columns on profiles).
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null unique references public.profiles(id) on delete cascade,
  plan_code text not null references public.subscription_plans(code),
  status_code text not null default 'active' references public.subscription_statuses(code),
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  last_payment_at timestamptz,
  next_billing_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A landlord's payment-receiving channels, shown to their tenants. Normalizes
-- the six payment_* columns that were on profiles into one row per method.
create table public.landlord_payout_methods (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  method text not null check (method in ('bank', 'gcash', 'paymaya', 'other')),
  account_name text,
  account_number text,
  details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (landlord_id, method)
);
