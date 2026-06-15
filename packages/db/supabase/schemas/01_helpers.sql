-- Shared trigger function: stamp updated_at on every UPDATE.
-- Attached to individual tables in 90_triggers.sql.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
