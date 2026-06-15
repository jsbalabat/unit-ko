-- Add bed space support to properties
-- This allows properties to have multiple tenant slots (bed spaces)
-- Note: max_tenants represents the PAX (number of tenants) for the property

-- Step 1: Add max_tenants column to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS max_tenants INTEGER DEFAULT 1;

COMMENT ON COLUMN properties.max_tenants IS 'Maximum number of tenants/bed spaces (PAX) for this property';

-- Step 2: Add tenant_slot column to tenants table
-- This tracks which bed space/slot number each tenant occupies
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS tenant_slot INTEGER DEFAULT 1;

COMMENT ON COLUMN tenants.tenant_slot IS 'The bed space slot number this tenant occupies (1, 2, 3, etc.). PAX (number of tenants) is defined at property level.';

-- Step 3: Add index for querying tenants by property and slot
CREATE INDEX IF NOT EXISTS idx_tenants_property_slot ON tenants(property_id, tenant_slot);

-- Step 4: Add constraint to ensure tenant_slot is positive and within max_tenants
-- Note: This is a basic constraint. Application logic should enforce max_tenants limit
ALTER TABLE tenants
ADD CONSTRAINT check_tenant_slot_positive CHECK (tenant_slot > 0);

-- Step 5: Add bed_space_billing_mode to properties
-- This tracks how billing is calculated: 'unified' (single billing) or 'per_tenant' (individual billing per tenant)
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS bed_space_billing_mode TEXT DEFAULT 'unified';

COMMENT ON COLUMN properties.bed_space_billing_mode IS 'Billing mode: unified (single billing for all) or per_tenant (individual billing per tenant)';

-- Step 6: Update existing properties to have default max_tenants = 1
UPDATE properties 
SET max_tenants = 1 
WHERE max_tenants IS NULL;

-- Step 7: Update existing tenants to have default tenant_slot = 1
UPDATE tenants 
SET tenant_slot = 1 
WHERE tenant_slot IS NULL;
