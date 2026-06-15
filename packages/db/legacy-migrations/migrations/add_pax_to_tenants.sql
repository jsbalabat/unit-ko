-- Add pax column to tenants table for bed space concept
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS pax INTEGER DEFAULT 1 CHECK (pax >= 1 AND pax <= 20);

-- Add comment for documentation
COMMENT ON COLUMN tenants.pax IS 'Number of persons (pax) sharing this unit - bed space concept';

-- Create index for faster queries on pax
CREATE INDEX IF NOT EXISTS idx_tenants_pax ON tenants(pax);
