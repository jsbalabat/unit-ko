-- Action type for a tenant being removed from a property (deactivated, their
-- active lease ended) via update_property_atomic. Previously this was buried in a
-- single opaque 'property_updated' row, indistinguishable from a rent change.
--
-- Seeded here as well as in seed.sql so the activity_logs FK holds on prod the
-- moment the API starts writing it.

insert into public.activity_action_types (code, label) values
  ('tenant_removed', 'Tenant removed')
on conflict (code) do nothing;
