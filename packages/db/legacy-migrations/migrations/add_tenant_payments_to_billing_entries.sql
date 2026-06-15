-- Add tenant_payments column to billing_entries table
-- This column stores JSON data tracking individual tenant payments in a pax system
-- Format: {"0": 1500, "1": 1500} where keys are tenant indices and values are their paid amounts

ALTER TABLE billing_entries
ADD COLUMN IF NOT EXISTS tenant_payments TEXT;

COMMENT ON COLUMN billing_entries.tenant_payments IS 'JSON string storing per-tenant payment tracking. Format: {"tenantIndex": paidAmount}. Used in pax/bed-space systems to track which tenants have paid their individual shares.';
