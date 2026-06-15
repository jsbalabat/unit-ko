-- Add pax_details column to tenants table to store individual person information
-- This will be a JSONB column storing an array of person objects with their details

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS pax_details JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN tenants.pax_details IS 'JSON array storing details for each person in the pax group. Each object contains: name, email, phone, and other personal information';

-- Create index for faster queries on pax_details
CREATE INDEX IF NOT EXISTS idx_tenants_pax_details ON tenants USING gin(pax_details);

-- Example structure:
-- pax_details: [
--   { "name": "John Doe", "email": "john@example.com", "phone": "1234567890" },
--   { "name": "Jane Smith", "email": "jane@example.com", "phone": "0987654321" }
-- ]
