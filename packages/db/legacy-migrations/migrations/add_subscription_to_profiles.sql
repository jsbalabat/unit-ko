-- Add subscription fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'basic', 'premium', 'enterprise')),
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'expired')),
ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ;

-- Create index for faster subscription lookups
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_plan ON profiles(subscription_plan);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);

-- Add comments for documentation
COMMENT ON COLUMN profiles.subscription_plan IS 'User subscription tier: free, basic, premium, or enterprise';
COMMENT ON COLUMN profiles.subscription_status IS 'Current subscription status: active, cancelled, or expired';
COMMENT ON COLUMN profiles.subscription_start_date IS 'Date when the current subscription started';
COMMENT ON COLUMN profiles.subscription_end_date IS 'Date when the current subscription ends';
COMMENT ON COLUMN profiles.last_payment_date IS 'Date of the last successful payment';
COMMENT ON COLUMN profiles.next_billing_date IS 'Date of the next scheduled billing';
