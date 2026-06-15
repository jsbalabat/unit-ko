-- Create activity_logs table
-- This table tracks all activities related to properties, tenants, and billing

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_property_id ON activity_logs(property_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);

-- Add comments
COMMENT ON TABLE activity_logs IS 'Tracks all property, tenant, and billing activities';
COMMENT ON COLUMN activity_logs.action_type IS 'Type of action: property_created, property_updated, tenant_added, tenant_updated, payment_made, billing_updated, property_reset, etc.';
COMMENT ON COLUMN activity_logs.description IS 'Human-readable description of the activity';
COMMENT ON COLUMN activity_logs.metadata IS 'Additional data related to the activity in JSON format';

-- Enable Row Level Security
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for landlords to view their property activities
CREATE POLICY "Landlords can view activity logs for their properties"
ON activity_logs
FOR SELECT
USING (
  property_id IN (
    SELECT id FROM properties 
    WHERE landlord_id = auth.uid()
  )
);

-- Create policy for inserting activity logs (system/authenticated users)
CREATE POLICY "Authenticated users can create activity logs"
ON activity_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
