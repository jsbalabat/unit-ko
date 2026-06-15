-- Enable Row Level Security (RLS) on all tables
-- This ensures data separation between different landlord accounts

-- Enable RLS on properties table
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Enable RLS on tenants table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Enable RLS on billing_entries table
ALTER TABLE billing_entries ENABLE ROW LEVEL SECURITY;

-- Enable RLS on archived_tenants table
ALTER TABLE archived_tenants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Landlords can view their own properties" ON properties;
DROP POLICY IF EXISTS "Landlords can insert their own properties" ON properties;
DROP POLICY IF EXISTS "Landlords can update their own properties" ON properties;
DROP POLICY IF EXISTS "Landlords can delete their own properties" ON properties;

DROP POLICY IF EXISTS "Landlords can view tenants of their properties" ON tenants;
DROP POLICY IF EXISTS "Landlords can insert tenants for their properties" ON tenants;
DROP POLICY IF EXISTS "Landlords can update tenants of their properties" ON tenants;
DROP POLICY IF EXISTS "Landlords can delete tenants of their properties" ON tenants;

DROP POLICY IF EXISTS "Landlords can view billing entries of their properties" ON billing_entries;
DROP POLICY IF EXISTS "Landlords can insert billing entries for their properties" ON billing_entries;
DROP POLICY IF EXISTS "Landlords can update billing entries of their properties" ON billing_entries;
DROP POLICY IF EXISTS "Landlords can delete billing entries of their properties" ON billing_entries;

DROP POLICY IF EXISTS "Landlords can view their archived tenants" ON archived_tenants;
DROP POLICY IF EXISTS "Landlords can insert their archived tenants" ON archived_tenants;
DROP POLICY IF EXISTS "Landlords can update their archived tenants" ON archived_tenants;
DROP POLICY IF EXISTS "Landlords can delete their archived tenants" ON archived_tenants;

-- Create RLS policies for properties table
CREATE POLICY "Landlords can view their own properties"
ON properties FOR SELECT
TO authenticated
USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can insert their own properties"
ON properties FOR INSERT
TO authenticated
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlords can update their own properties"
ON properties FOR UPDATE
TO authenticated
USING (landlord_id = auth.uid())
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlords can delete their own properties"
ON properties FOR DELETE
TO authenticated
USING (landlord_id = auth.uid());

-- Create RLS policies for tenants table
CREATE POLICY "Landlords can view tenants of their properties"
ON tenants FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = tenants.property_id
    AND properties.landlord_id = auth.uid()
  )
);

CREATE POLICY "Landlords can insert tenants for their properties"
ON tenants FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = tenants.property_id
    AND properties.landlord_id = auth.uid()
  )
);

CREATE POLICY "Landlords can update tenants of their properties"
ON tenants FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = tenants.property_id
    AND properties.landlord_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = tenants.property_id
    AND properties.landlord_id = auth.uid()
  )
);

CREATE POLICY "Landlords can delete tenants of their properties"
ON tenants FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = tenants.property_id
    AND properties.landlord_id = auth.uid()
  )
);

-- Create RLS policies for billing_entries table
CREATE POLICY "Landlords can view billing entries of their properties"
ON billing_entries FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = billing_entries.property_id
    AND properties.landlord_id = auth.uid()
  )
);

CREATE POLICY "Landlords can insert billing entries for their properties"
ON billing_entries FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = billing_entries.property_id
    AND properties.landlord_id = auth.uid()
  )
);

CREATE POLICY "Landlords can update billing entries of their properties"
ON billing_entries FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = billing_entries.property_id
    AND properties.landlord_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = billing_entries.property_id
    AND properties.landlord_id = auth.uid()
  )
);

CREATE POLICY "Landlords can delete billing entries of their properties"
ON billing_entries FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM properties
    WHERE properties.id = billing_entries.property_id
    AND properties.landlord_id = auth.uid()
  )
);

-- Create RLS policies for archived_tenants table
CREATE POLICY "Landlords can view their archived tenants"
ON archived_tenants FOR SELECT
TO authenticated
USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can insert their archived tenants"
ON archived_tenants FOR INSERT
TO authenticated
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlords can update their archived tenants"
ON archived_tenants FOR UPDATE
TO authenticated
USING (landlord_id = auth.uid())
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlords can delete their archived tenants"
ON archived_tenants FOR DELETE
TO authenticated
USING (landlord_id = auth.uid());

-- Verification query (optional - run this to check if policies are applied)
-- SELECT tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
