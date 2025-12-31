-- Drop existing profiles table if it exists (to ensure clean state)
DROP TABLE IF EXISTS profiles CASCADE;

-- Create profiles table for users (landlords and tenants)
CREATE TABLE profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('landlord', 'tenant')),
  tenant_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_tenant_id ON profiles(tenant_id);

-- Add RLS (Row Level Security) policies if needed
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users (adjust based on your auth setup)
-- CREATE POLICY "Users can view their own profile" ON profiles
--   FOR SELECT USING (auth.uid() = id);

-- CREATE POLICY "Users can update their own profile" ON profiles
--   FOR UPDATE USING (auth.uid() = id);

COMMENT ON TABLE profiles IS 'User profiles for both landlords and tenants';
COMMENT ON COLUMN profiles.role IS 'User role: landlord or tenant';
COMMENT ON COLUMN profiles.tenant_id IS 'Reference to tenant record if role is tenant';
