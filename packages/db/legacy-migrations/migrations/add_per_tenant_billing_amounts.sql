-- Add per-tenant rent and charges tracking to billing_entries table
-- This allows individual tenant rent/charges edits without affecting other tenants

-- Add tenant_rent_amounts column (JSON string mapping tenant index to rent amount)
-- Example: {"0": 5000, "1": 6000, "2": 5000}
ALTER TABLE billing_entries
ADD COLUMN IF NOT EXISTS tenant_rent_amounts TEXT;

-- Add tenant_other_charges column (JSON string mapping tenant index to charges amount)
-- Example: {"0": 200, "1": 300, "2": 150}
ALTER TABLE billing_entries
ADD COLUMN IF NOT EXISTS tenant_other_charges TEXT;

-- Add comments to document the new columns
COMMENT ON COLUMN billing_entries.tenant_rent_amounts IS 
  'JSON string mapping tenant index to individual rent amount: {"0": 5000, "1": 6000}. Used for individual tenant billing edits.';

COMMENT ON COLUMN billing_entries.tenant_other_charges IS 
  'JSON string mapping tenant index to individual charges amount: {"0": 200, "1": 300}. Used for individual tenant billing edits.';

-- Note: For backward compatibility, if these fields are NULL, the system will:
-- 1. Fall back to dividing rent_due and other_charges equally by pax_count
-- 2. Initialize these fields when individual tenant edits are made
-- 
-- Property-level fields (rent_due, other_charges, gross_due) remain as totals
-- and are calculated by summing all tenant amounts from these JSON fields
