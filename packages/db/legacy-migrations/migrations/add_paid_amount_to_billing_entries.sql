-- Add paid_amount column to billing_entries table
-- This column tracks how much has been paid for each billing entry

ALTER TABLE billing_entries
ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;

-- Update existing records to set paid_amount to 0 if NULL
UPDATE billing_entries
SET paid_amount = 0
WHERE paid_amount IS NULL;

-- Add comment to column
COMMENT ON COLUMN billing_entries.paid_amount IS 'Amount paid towards this billing entry';
