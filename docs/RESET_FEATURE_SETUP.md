# Property Reset Feature - Setup Instructions

## Database Setup

Before using the property reset feature, you need to create the `archived_tenants` table in your Supabase database.

### Step 1: Run the Migration

1. Open your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `database/migrations/create_archived_tenants_table.sql`
4. Paste and execute the SQL script

Alternatively, if you're using a local development setup:

```bash
# Run the migration using Supabase CLI
supabase db push
```

### Step 2: Verify Table Creation

Check that the table was created successfully:

```sql
SELECT * FROM archived_tenants LIMIT 1;
```

You should see the table structure even if it's empty.

### Step 3: Enable Row Level Security (Optional)

If you're using Supabase authentication, enable RLS policies:

```sql
ALTER TABLE archived_tenants ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their archived tenants
CREATE POLICY "Users can view their own archives"
  ON archived_tenants
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to insert archives
CREATE POLICY "Users can create archives"
  ON archived_tenants
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
```

## Feature Components

The property reset feature consists of:

1. **PropertyResetDialog** - Confirmation dialog for resetting properties
2. **ArchiveService** - Service layer for archiving operations
3. **Archives Page** - View and manage archived rentals
4. **Updated Property Details** - Reset button integration

## Usage Flow

1. **Property Details** → Click "Reset Property" button
2. **Reset Dialog** → Enter archive remarks and confirm
3. **Archive Process** → System archives data and resets property
4. **Confirmation** → Toast notification confirms success
5. **View Archives** → Access via sidebar "Archived Rentals" link

## Files Created/Modified

### New Files
- `src/components/property-reset-dialog.tsx`
- `src/services/archiveService.ts`
- `src/app/dashboard/landlord/archives/page.tsx`
- `src/components/ui/textarea.tsx`
- `database/migrations/create_archived_tenants_table.sql`
- `docs/PROPERTY_RESET_GUIDE.md`

### Modified Files
- `src/components/property-details-popup.tsx` - Added reset button
- `src/components/app-sidebar.tsx` - Added archives link

## Testing

After setup, test the feature:

1. Create a test property with an active tenant
2. Add some billing entries
3. Open the property details
4. Click "Reset Property"
5. Fill in the remarks and confirm
6. Verify property is now vacant
7. Check archives page for the archived data

## Troubleshooting

### Error: "Failed to create archive"
- Check that the archived_tenants table exists
- Verify database permissions
- Check browser console for detailed errors

### Error: "Property not found"
- Ensure the property ID is valid
- Check that the property exists in the database

### Reset button not showing
- Reset button only appears for occupied properties
- Check that the property has an active tenant

## Support

For issues or questions, refer to:
- `docs/PROPERTY_RESET_GUIDE.md` - Complete user guide
- Supabase documentation
- Application error logs
