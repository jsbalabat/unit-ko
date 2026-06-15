-- Add notes column to properties table
-- Stores JSON array of note objects: [{id, text, createdAt, updatedAt?}]
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '[]';

COMMENT ON COLUMN properties.notes IS 'JSON array of property notes with timestamps';
