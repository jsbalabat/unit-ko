-- Fix infinite recursion in profiles RLS policies
-- The issue: the SELECT policy was querying the profiles table within itself

-- Step 1: Drop all existing SELECT policies
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Tenants can view landlord payment info" ON profiles;

-- Step 2: Create a simple policy that allows users to see their own profile
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Step 3: Verify the policy was created
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can view their own profile'
  ) THEN
    RAISE NOTICE 'Policy "Users can view their own profile" successfully created';
  ELSE
    RAISE WARNING 'Failed to create policy!';
  END IF;
END $$;
