-- Fix profiles RLS policies to allow proper access
-- This script resolves the issue where profiles table appears empty

-- Step 1: Drop conflicting policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Tenants can view landlord payment info" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;

-- Step 2: Recreate the SELECT policy with proper permissions
-- This allows:
-- 1. Users to view their own profile
-- 2. Tenants to view their landlord's payment information
CREATE POLICY "Users can view profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow users to see their own profile
    auth.uid() = id
    OR
    -- Allow tenants to see landlord profiles for properties they rent
    -- First check if the current user is a tenant
    EXISTS (
      SELECT 1 FROM profiles tenant_profile
      WHERE tenant_profile.id = auth.uid()
      AND tenant_profile.role = 'tenant'
      AND tenant_profile.tenant_id IS NOT NULL
      -- Then check if the profile being viewed is their landlord
      AND EXISTS (
        SELECT 1 FROM tenants t
        INNER JOIN properties p ON p.id = t.property_id
        WHERE t.id = tenant_profile.tenant_id
        AND p.landlord_id = profiles.id
      )
    )
  );

-- Step 3: Verify other policies still exist (these should already be there)
-- If not, recreate them

DO $$ 
BEGIN
  -- Check if INSERT policy exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile" ON profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;

  -- Check if UPDATE policy exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile" ON profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;

  -- Check if service role policy exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Service role has full access'
  ) THEN
    CREATE POLICY "Service role has full access" ON profiles
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Step 4: Backfill profiles for any existing auth users without profiles
-- This creates profile records for landlords who registered before the trigger was working
INSERT INTO profiles (id, email, role, full_name, phone, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'role', 'landlord') as role,
  COALESCE(
    au.raw_user_meta_data->>'username',
    au.raw_user_meta_data->>'full_name',
    SPLIT_PART(au.email, '@', 1)
  ) as full_name,
  au.raw_user_meta_data->>'phone' as phone,
  au.created_at,
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- Step 5: Display summary
DO $$ 
DECLARE
  profile_count INTEGER;
  auth_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM profiles;
  SELECT COUNT(*) INTO auth_count FROM auth.users;
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  - Auth users: %', auth_count;
  RAISE NOTICE '  - Profile records: %', profile_count;
  
  IF profile_count < auth_count THEN
    RAISE WARNING 'Some auth users are missing profiles! This should not happen.';
  END IF;
END $$;
