# Property Reset & Archiving Feature

## Overview
This feature allows landlords to smoothly transition properties from one tenant to another by archiving the current rental data and resetting the property to vacant status.

## Key Features

### 1. **Property Reset**
- Archive current tenant data
- Reset property to vacant status
- Preserve complete rental history
- Maintain data integrity

### 2. **Data Archiving**
- All tenant information saved
- Complete billing history preserved
- Financial summaries calculated
- Searchable archive records

### 3. **Separate Archives Page**
- View all archived rentals
- Detailed billing history
- Financial summaries
- Export capabilities

## How to Use

### Resetting a Property

1. **Open Property Details**
   - Navigate to your property dashboard
   - Click "Details" on the property card you want to reset

2. **Initiate Reset**
   - In the property details popup, click "Reset Property" button (orange button)
   - This button only appears for occupied properties

3. **Provide Archive Remarks**
   - Enter a detailed reason for the reset (minimum 10 characters)
   - Examples:
     - "Contract completed successfully. Tenant moved out on schedule."
     - "Early termination by mutual agreement due to tenant relocation."
     - "Lease ended, property ready for renovation and new tenant."

4. **Confirm Reset**
   - Review the confirmation details
   - Click "Archive & Reset" to proceed
   - The system will:
     - Archive all tenant data
     - Archive all billing entries
     - Calculate financial totals
     - Reset property to vacant
     - Generate archive record

### Viewing Archived Data

1. **Access Archives**
   - Click "Archived Rentals" in the sidebar
   - View all your historical rental data

2. **Search & Filter**
   - Search by property name
   - Filter by date range
   - Sort by various criteria

3. **View Details**
   - Click "View Details" on any archive card
   - See complete rental history
   - Review billing entries
   - Check financial summaries

## What Gets Archived

### Tenant Information
- Tenant name and contact
- Contract duration
- Start and end dates
- Due day preferences

### Property Information
- Property name and type
- Location details
- Monthly rent amount

### Financial Data
- All billing entries
- Payment status for each period
- Total amount due
- Total amount paid
- Outstanding balance

### Additional Data
- Archive timestamp
- Archive reason/remarks
- Original creation date

## Best Practices

### When to Reset a Property

✅ **Good Times to Reset:**
- Contract period has ended
- Tenant has moved out
- Property needs renovation
- Ready for a new tenant
- Early termination agreed upon

❌ **Don't Reset When:**
- Tenant is still actively renting
- Outstanding disputes unresolved
- Mid-contract without agreement
- Financial settlements pending

### Writing Good Archive Remarks

**✅ Good Examples:**
```
"12-month contract completed. Tenant vacated on time. Property in good condition, ready for next tenant."

"Early termination by mutual consent. Tenant relocated for work. All dues settled. Property cleaned and ready."

"Contract expired. Tenant chose not to renew. Unit requires minor repairs before re-listing."
```

**❌ Poor Examples:**
```
"Done" (too vague)
"Finished" (no context)
"Reset" (not informative)
```

## Data Safety

### What Happens During Reset
1. **Archive Created First** - All data copied to archive
2. **Verification** - System verifies archive success
3. **Cleanup** - Only after successful archive, data is removed
4. **Status Update** - Property marked as vacant

### Cannot Be Undone
⚠️ **Important:** The reset process cannot be reversed. Once completed:
- The tenant record is permanently removed from active database
- All billing entries are cleared
- Property returns to vacant status
- **However**, all data is safely preserved in the archive

### Access Archives Anytime
- Archives are permanent
- Can be viewed at any time
- Export functionality available
- Full billing history preserved

## Troubleshooting

### Reset Button Not Visible
- **Cause:** Property is already vacant or has no active tenant
- **Solution:** Reset button only appears for occupied properties

### Reset Failed
- **Possible Causes:**
  - Network connection issue
  - Database constraint violation
  - Missing required data
- **Solution:** 
  - Check your internet connection
  - Try again
  - Contact support if persists

### Cannot View Archives
- **Cause:** No archived data yet
- **Solution:** Archives will appear after you perform your first property reset

## Database Schema

### Archived Tenants Table
```sql
archived_tenants (
  id UUID PRIMARY KEY
  property_id UUID
  property_name TEXT
  property_type TEXT
  property_location TEXT
  tenant_name TEXT
  contact_number TEXT
  contract_months INTEGER
  rent_start_date DATE
  rent_end_date DATE
  due_day TEXT
  rent_amount DECIMAL
  total_paid DECIMAL
  total_due DECIMAL
  archive_reason TEXT
  billing_entries JSONB
  archived_at TIMESTAMPTZ
  created_at TIMESTAMPTZ
)
```

## FAQ

**Q: Can I reset a vacant property?**
A: No, reset is only available for occupied properties with active tenants.

**Q: Will I lose the property itself?**
A: No, only the tenant and billing data are archived. The property remains in your portfolio.

**Q: Can I undo a reset?**
A: No, but all data is preserved in the archives for reference.

**Q: How do I add a new tenant after reset?**
A: After reset, the property returns to vacant status. Use the "Edit Property" feature to add a new tenant.

**Q: Can I export archived data?**
A: Future updates will include export functionality. Currently, you can view all data in the archives page.

**Q: Is there a limit to how many archives I can have?**
A: No limit. All your historical rental data is preserved indefinitely.

## Support

For additional help or to report issues:
- Check the troubleshooting section
- Review the best practices guide
- Contact technical support

---

**Version:** 1.0.0  
**Last Updated:** December 2025  
**Feature Status:** ✅ Production Ready
