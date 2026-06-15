    -- Script to clean up test data
-- WARNING: This will delete data. Use with caution!
-- Only run this if you want to remove all test properties and start fresh

-- Before running this script, you might want to backup your data
-- You can do this by exporting the tables from Supabase Dashboard

-- Option 1: Delete ALL data (complete reset)
-- Uncomment the lines below to delete all data from all tables

-- DELETE FROM billing_entries;
-- DELETE FROM tenants;
-- DELETE FROM archived_tenants;
-- DELETE FROM properties;
-- DELETE FROM profiles WHERE role = 'tenant';

-- Option 2: Delete data for a specific landlord (safer for multi-user environment)
-- Replace 'YOUR_USER_ID_HERE' with the actual user ID you want to clean
-- You can get your user ID from the Supabase Dashboard > Authentication > Users

-- DELETE FROM billing_entries 
-- WHERE property_id IN (
--   SELECT id FROM properties WHERE landlord_id = 'YOUR_USER_ID_HERE'
-- );

-- DELETE FROM tenants 
-- WHERE property_id IN (
--   SELECT id FROM properties WHERE landlord_id = 'YOUR_USER_ID_HERE'
-- );

-- DELETE FROM archived_tenants 
-- WHERE landlord_id = 'YOUR_USER_ID_HERE';

-- DELETE FROM properties 
-- WHERE landlord_id = 'YOUR_USER_ID_HERE';

-- Option 3: Delete only test properties (based on naming pattern)
-- This deletes properties with "test" in the unit name (case-insensitive)

-- DELETE FROM billing_entries 
-- WHERE property_id IN (
--   SELECT id FROM properties WHERE LOWER(unit_name) LIKE '%test%'
-- );

-- DELETE FROM tenants 
-- WHERE property_id IN (
--   SELECT id FROM properties WHERE LOWER(unit_name) LIKE '%test%'
-- );

-- DELETE FROM properties 
-- WHERE LOWER(unit_name) LIKE '%test%';

-- Verify counts after cleanup (uncomment to check)
-- SELECT 
--   (SELECT COUNT(*) FROM properties) as total_properties,
--   (SELECT COUNT(*) FROM tenants) as total_tenants,
--   (SELECT COUNT(*) FROM billing_entries) as total_billing_entries,
--   (SELECT COUNT(*) FROM archived_tenants) as total_archived_tenants;
