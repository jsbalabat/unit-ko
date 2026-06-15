-- Add expense_items column to billing_entries table
-- This column stores detailed breakdown of other charges as JSON

ALTER TABLE billing_entries 
ADD COLUMN IF NOT EXISTS expense_items JSONB DEFAULT '[]'::jsonb;

-- Add index for faster queries on expense_items
CREATE INDEX IF NOT EXISTS idx_billing_entries_expense_items ON billing_entries USING gin(expense_items);

COMMENT ON COLUMN billing_entries.expense_items IS 'JSON array storing detailed breakdown of other charges. Each object contains: id, name, amount';

-- Example structure:
-- expense_items: [
--   { "id": "exp-123", "name": "Water Bill", "amount": 500 },
--   { "id": "exp-456", "name": "Electricity", "amount": 1500 }
-- ]
