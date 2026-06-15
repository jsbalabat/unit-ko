-- Add landlord_id column to properties table to track property ownership
-- This allows each landlord to only see and manage their own properties

-- Step 1: Add the landlord_id column (nullable initially)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS landlord_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_properties_landlord_id ON properties(landlord_id);

-- Step 3: Enable Row Level Security (RLS) on properties table
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for properties

-- Policy: Landlords can only view their own properties
CREATE POLICY "Landlords can view own properties" ON properties
  FOR SELECT
  USING (auth.uid() = landlord_id);

-- Policy: Landlords can only insert properties with their own ID
CREATE POLICY "Landlords can insert own properties" ON properties
  FOR INSERT
  WITH CHECK (auth.uid() = landlord_id);

-- Policy: Landlords can only update their own properties
CREATE POLICY "Landlords can update own properties" ON properties
  FOR UPDATE
  USING (auth.uid() = landlord_id)
  WITH CHECK (auth.uid() = landlord_id);

-- Policy: Landlords can only delete their own properties
CREATE POLICY "Landlords can delete own properties" ON properties
  FOR DELETE
  USING (auth.uid() = landlord_id);

-- Step 5: Enable RLS on related tables

-- Tenants table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Policy: Landlords can access tenants for their properties
CREATE POLICY "Landlords can view tenants of own properties" ON tenants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE properties.id = tenants.property_id 
      AND properties.landlord_id = auth.uid()
    )
  );

CREATE POLICY "Landlords can insert tenants for own properties" ON tenants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE properties.id = tenants.property_id 
      AND properties.landlord_id = auth.uid()
    )
  );

CREATE POLICY "Landlords can update tenants of own properties" ON tenants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE properties.id = tenants.property_id 
      AND properties.landlord_id = auth.uid()
    )
  );

CREATE POLICY "Landlords can delete tenants of own properties" ON tenants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE properties.id = tenants.property_id 
      AND properties.landlord_id = auth.uid()
    )
  );

-- Billing entries table
ALTER TABLE billing_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Landlords can access billing entries for their properties
CREATE POLICY "Landlords can view billing for own properties" ON billing_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE properties.id = billing_entries.property_id 
      AND properties.landlord_id = auth.uid()
    )
  );

CREATE POLICY "Landlords can insert billing for own properties" ON billing_entries
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE properties.id = billing_entries.property_id 
      AND properties.landlord_id = auth.uid()
    )
  );

CREATE POLICY "Landlords can update billing for own properties" ON billing_entries
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE properties.id = billing_entries.property_id 
      AND properties.landlord_id = auth.uid()
    )
  );

CREATE POLICY "Landlords can delete billing for own properties" ON billing_entries
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE properties.id = billing_entries.property_id 
      AND properties.landlord_id = auth.uid()
    )
  );

-- Step 6: Update archives table with landlord_id
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'archived_tenants') THEN
    -- Add landlord_id column if it doesn't exist
    ALTER TABLE archived_tenants 
    ADD COLUMN IF NOT EXISTS landlord_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    
    -- Create index
    CREATE INDEX IF NOT EXISTS idx_archived_tenants_landlord_id ON archived_tenants(landlord_id);
    
    -- Enable RLS
    ALTER TABLE archived_tenants ENABLE ROW LEVEL SECURITY;
    
    -- Policy: Landlords can only view their own archives
    DROP POLICY IF EXISTS "Landlords can view own archives" ON archived_tenants;
    CREATE POLICY "Landlords can view own archives" ON archived_tenants
      FOR SELECT
      USING (landlord_id = auth.uid());
    
    DROP POLICY IF EXISTS "Landlords can insert own archives" ON archived_tenants;
    CREATE POLICY "Landlords can insert own archives" ON archived_tenants
      FOR INSERT
      WITH CHECK (landlord_id = auth.uid());
  END IF;
END $$;

-- Note: After running this migration, you need to update existing properties
-- to assign them to a landlord_id. You can do this manually or create a script
-- to assign all existing properties to a specific landlord user ID.
