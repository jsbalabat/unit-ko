create table public.properties (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.profiles(id) on delete cascade,
  unit_name text not null,
  property_type_code text references public.property_types(code),
  property_location text,
  rent_amount numeric(12, 2) not null default 0,
  max_tenants integer not null default 1 check (max_tenants >= 1),
  billing_mode text not null default 'unified' check (billing_mode in ('unified', 'per_tenant')),
  lease_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_properties_landlord on public.properties (landlord_id);

-- Was properties.notes (a JSON array stuffed in a text column).
create table public.property_notes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_property_notes_property on public.property_notes (property_id);

-- Was properties.amenities (a JSON array of amenity ids in a text column).
create table public.property_amenities (
  property_id uuid not null references public.properties(id) on delete cascade,
  amenity_code text not null references public.amenities(code) on delete cascade,
  primary key (property_id, amenity_code)
);
