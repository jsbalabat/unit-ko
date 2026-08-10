-- Landlord identity, 1:1 with auth.users. The subscription, payout, and
-- tenant-link columns that used to live here are normalized into their own
-- tables (subscriptions, landlord_payout_methods, tenants).
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext unique not null,
  full_name text,
  username text,
  phone text,
  role text not null default 'landlord' check (role in ('landlord', 'tenant')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_email on public.profiles (email);

-- Auto-create a landlord profile when a new auth user signs up.
-- The trigger ON auth.users lives in a forward migration
-- (20260810120000_auth_signup_trigger.sql), not here: `supabase db diff` only
-- manages the public schema, so an auth-schema trigger can't be declared in schemas/.
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
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
$$;
