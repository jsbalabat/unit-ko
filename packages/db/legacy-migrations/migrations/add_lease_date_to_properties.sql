-- Migration: Add lease_date column to properties table
-- Description: Adds an optional lease/contract date field to track when lease agreements were signed
-- Date: 2026-03-12

-- Add lease_date column to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS lease_date DATE;

-- Add comment to document the column purpose
COMMENT ON COLUMN properties.lease_date IS 'Optional date when the lease/contract was signed';
