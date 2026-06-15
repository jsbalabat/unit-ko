-- Safety migration: normalize legacy activity_logs columns to canonical schema.
-- Canonical columns:
--   action_type, description, metadata
-- Legacy columns handled (if present):
--   action, details

-- 1) Ensure canonical columns exist.
ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS action_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2) Backfill canonical columns from legacy columns when possible.
DO $$
BEGIN
  -- action -> action_type
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activity_logs'
      AND column_name = 'action'
  ) THEN
    EXECUTE '
      UPDATE activity_logs
      SET action_type = COALESCE(action_type, action)
      WHERE action_type IS NULL
    ';
  END IF;

  -- details -> metadata
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activity_logs'
      AND column_name = 'details'
  ) THEN
    EXECUTE '
      UPDATE activity_logs
      SET metadata = COALESCE(metadata, details)
      WHERE metadata IS NULL
    ';
  END IF;
END
$$;

-- 3) Fill any remaining required values with safe defaults.
UPDATE activity_logs
SET action_type = 'legacy_event'
WHERE action_type IS NULL OR btrim(action_type) = '';

UPDATE activity_logs
SET description = 'Legacy activity entry'
WHERE description IS NULL OR btrim(description) = '';

UPDATE activity_logs
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

UPDATE activity_logs
SET created_at = NOW()
WHERE created_at IS NULL;

-- 4) Enforce canonical required columns.
ALTER TABLE activity_logs
  ALTER COLUMN action_type SET NOT NULL,
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN created_at SET DEFAULT NOW();

-- 5) Remove legacy columns now that data has been migrated.
ALTER TABLE activity_logs
  DROP COLUMN IF EXISTS action,
  DROP COLUMN IF EXISTS details;

-- 6) Keep canonical schema documentation aligned.
COMMENT ON COLUMN activity_logs.action_type IS
'Canonical event key. Examples: property_updated, billing_updated, payment_made, property_note_added, property_note_updated, property_note_deleted, tenant_reminder_sent, property_reset, property_created, tenant_added, tenant_updated.';
