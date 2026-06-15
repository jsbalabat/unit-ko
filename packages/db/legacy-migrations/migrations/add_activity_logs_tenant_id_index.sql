-- Add missing index for tenant-based activity log queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_id
ON activity_logs(tenant_id);
