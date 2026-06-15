-- Persist explicit billing frequency and per-person amount for tenants.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS billing_frequency TEXT,
  ADD COLUMN IF NOT EXISTS rent_per_person NUMERIC(12,2);

ALTER TABLE tenants
  ALTER COLUMN billing_frequency SET DEFAULT 'monthly',
  ALTER COLUMN rent_per_person SET DEFAULT 0;

UPDATE tenants
SET billing_frequency = COALESCE(billing_frequency, 'monthly');

UPDATE tenants t
SET rent_per_person = COALESCE(
  t.rent_per_person,
  ROUND((p.rent_amount / NULLIF(COALESCE(t.pax, 1), 0))::numeric, 2),
  0
)
FROM properties p
WHERE p.id = t.property_id
  AND (t.rent_per_person IS NULL OR t.rent_per_person = 0);

COMMENT ON COLUMN tenants.billing_frequency IS
'Billing frequency basis for the tenant contract: weekly, bi-weekly, monthly, quarterly, semi-annually, or annually.';

COMMENT ON COLUMN tenants.rent_per_person IS
'Per-tenant rent amount for each billing period based on billing_frequency.';
