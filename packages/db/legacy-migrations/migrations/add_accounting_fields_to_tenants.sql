-- Migration: Add accounting and deposit fields to tenants table
-- Description: Adds advance_payment, security_deposit, and receipt_timestamp columns
-- Date: 2026-01-19

-- Add advance_payment column (numeric, defaults to 0)
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS advance_payment NUMERIC DEFAULT 0;

-- Add security_deposit column (numeric, defaults to 0)
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS security_deposit NUMERIC DEFAULT 0;

-- Add receipt_timestamp column (timestamp with time zone, nullable)
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS receipt_timestamp TIMESTAMP WITH TIME ZONE;

-- Add comments for documentation
COMMENT ON COLUMN tenants.advance_payment IS 'Advance rent payment amount collected from tenant';
COMMENT ON COLUMN tenants.security_deposit IS 'Security deposit amount collected from tenant';
COMMENT ON COLUMN tenants.receipt_timestamp IS 'Date and time when payment/deposit was received';
