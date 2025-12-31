import { supabase } from '@/lib/supabase';

export interface ArchivedTenant {
  id: string;
  property_id: string;
  property_name: string;
  property_type: string;
  property_location: string;
  tenant_name: string;
  contact_number: string;
  contract_months: number;
  rent_start_date: string;
  rent_end_date: string;
  due_day: string;
  rent_amount: number;
  total_paid: number;
  total_due: number;
  archive_reason: string;
  archived_at: string;
  billing_entries: string; // JSON string of billing entries
  created_at: string;
}

interface ResetPropertyData {
  propertyId: string;
  tenantId: string;
  remarks: string;
}

export async function archiveAndResetProperty(data: ResetPropertyData): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { propertyId, tenantId, remarks } = data;

    // 1. Fetch current property data
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (propertyError || !property) {
      throw new Error('Property not found');
    }

    // 2. Fetch current tenant data
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .eq('property_id', propertyId)
      .single();

    if (tenantError || !tenant) {
      throw new Error('Tenant not found');
    }

    // 3. Fetch all billing entries for this tenant
    const { data: billingEntries, error: billingError } = await supabase
      .from('billing_entries')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('billing_period', { ascending: true });

    if (billingError) {
      throw new Error('Failed to fetch billing entries');
    }

    // 4. Calculate totals
    const totalDue = billingEntries?.reduce((sum, entry) => sum + entry.gross_due, 0) || 0;
    const totalPaid = billingEntries?.filter(
      (entry) => entry.status.toLowerCase().includes('paid') || entry.status.toLowerCase().includes('good standing')
    ).reduce((sum, entry) => sum + entry.gross_due, 0) || 0;

    // 5. Calculate rent end date (start date + contract months)
    const rentStartDate = new Date(tenant.rent_start_date);
    const rentEndDate = new Date(rentStartDate);
    rentEndDate.setMonth(rentEndDate.getMonth() + tenant.contract_months);

    // 6. Create archive entry
    const { error: archiveError } = await supabase
      .from('archived_tenants')
      .insert({
        property_id: propertyId,
        property_name: property.unit_name,
        property_type: property.property_type,
        property_location: property.property_location,
        tenant_name: tenant.tenant_name,
        contact_number: tenant.contact_number,
        contract_months: tenant.contract_months,
        rent_start_date: tenant.rent_start_date,
        rent_end_date: rentEndDate.toISOString().split('T')[0],
        due_day: tenant.due_day,
        rent_amount: property.rent_amount,
        total_paid: totalPaid,
        total_due: totalDue,
        archive_reason: remarks,
        billing_entries: JSON.stringify(billingEntries || []),
        archived_at: new Date().toISOString(),
      });

    if (archiveError) {
      console.error('Archive error:', archiveError);
      throw new Error('Failed to create archive');
    }

    // 7. Delete billing entries
    const { error: deleteBillingError } = await supabase
      .from('billing_entries')
      .delete()
      .eq('tenant_id', tenantId);

    if (deleteBillingError) {
      console.error('Delete billing error:', deleteBillingError);
      throw new Error('Failed to delete billing entries');
    }

    // 8. Delete tenant
    const { error: deleteTenantError } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenantId);

    if (deleteTenantError) {
      console.error('Delete tenant error:', deleteTenantError);
      throw new Error('Failed to delete tenant');
    }

    // 9. Update property to vacant
    const { error: updatePropertyError } = await supabase
      .from('properties')
      .update({
        occupancy_status: 'vacant',
        updated_at: new Date().toISOString(),
      })
      .eq('id', propertyId);

    if (updatePropertyError) {
      console.error('Update property error:', updatePropertyError);
      throw new Error('Failed to update property status');
    }

    return { success: true };
  } catch (error) {
    console.error('Archive and reset error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
}

export async function fetchArchivedTenants(): Promise<{
  data: ArchivedTenant[] | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('archived_tenants')
      .select('*')
      .order('archived_at', { ascending: false });

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error('Fetch archived tenants error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch archived tenants',
    };
  }
}

export async function fetchArchivedTenantsByProperty(propertyId: string): Promise<{
  data: ArchivedTenant[] | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from('archived_tenants')
      .select('*')
      .eq('property_id', propertyId)
      .order('archived_at', { ascending: false });

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error('Fetch archived tenants by property error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch archived tenants',
    };
  }
}
