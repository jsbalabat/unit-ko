-- Add email column to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email TEXT;

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email);

COMMENT ON COLUMN tenants.email IS 'Tenant email address for communication and profile creation';
