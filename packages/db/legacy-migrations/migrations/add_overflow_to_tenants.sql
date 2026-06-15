-- Add overflow field to tenants table
-- This field tracks excess payments that can be applied to future billing periods

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS overflow NUMERIC DEFAULT 0;

-- Add comment to explain the field
COMMENT ON COLUMN tenants.overflow IS 'Excess payment amount that can be applied to future billing periods. Priority rules: For positive payments - highest priority to be deducted from (used to pay bills first). For negative payments (refunds) - highest priority to be subtracted from (deducted first before billing entries).';
