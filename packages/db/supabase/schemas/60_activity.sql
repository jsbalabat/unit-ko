create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  lease_id uuid references public.leases(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  action_type_code text not null references public.activity_action_types(code),
  description text not null,
  metadata jsonb not null default '{}',   -- a genuine document; legitimately jsonb
  created_at timestamptz not null default now()
);

create index idx_activity_logs_property on public.activity_logs (property_id);
create index idx_activity_logs_created on public.activity_logs (created_at desc);
-- Serves the landlord feed's `where user_id = … order by created_at desc`.
create index idx_activity_logs_user on public.activity_logs (user_id, created_at desc);
