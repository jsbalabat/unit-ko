-- Add landlord payment details to profiles table
-- These details will be visible to tenants for payment purposes

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS payment_bank_name TEXT,
ADD COLUMN IF NOT EXISTS payment_account_name TEXT,
ADD COLUMN IF NOT EXISTS payment_account_number TEXT,
ADD COLUMN IF NOT EXISTS payment_gcash_number TEXT,
ADD COLUMN IF NOT EXISTS payment_paymaya_number TEXT,
ADD COLUMN IF NOT EXISTS payment_other_details TEXT;

-- Add comments for clarity
COMMENT ON COLUMN profiles.payment_bank_name IS 'Bank name for tenant payments';
COMMENT ON COLUMN profiles.payment_account_name IS 'Account holder name for bank transfers';
COMMENT ON COLUMN profiles.payment_account_number IS 'Bank account number for tenant payments';
COMMENT ON COLUMN profiles.payment_gcash_number IS 'GCash number for tenant payments';
COMMENT ON COLUMN profiles.payment_paymaya_number IS 'PayMaya number for tenant payments';
COMMENT ON COLUMN profiles.payment_other_details IS 'Additional payment instructions or details';

-- Update the updated_at timestamp function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update the existing RLS policy to allow tenants to view their landlord's payment details
-- This replaces the "Users can view their own profile" policy to include tenant access
DO $$ 
BEGIN
  -- Drop the old policy
  DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
  DROP POLICY IF EXISTS "Tenants can view landlord payment info" ON profiles;
  
  -- Create combined policy that allows both self-viewing and tenant-landlord viewing
  CREATE POLICY "Users can view profiles" ON profiles
    FOR SELECT
    USING (
      -- Allow users to see their own profile
      auth.uid() = id
      OR
      -- Allow tenants to see payment details of landlords who own properties they rent
      id IN (
        SELECT p.landlord_id 
        FROM properties p
        INNER JOIN tenants t ON t.property_id = p.id
        INNER JOIN profiles prof ON prof.tenant_id = t.id
        WHERE prof.id = auth.uid()
      )
    );
END $$;
