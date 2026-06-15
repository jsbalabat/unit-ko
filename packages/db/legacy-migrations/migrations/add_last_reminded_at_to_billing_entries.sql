ALTER TABLE billing_entries
ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_billing_entries_last_reminded_at
ON billing_entries(last_reminded_at DESC);