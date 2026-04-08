import { supabase } from '@/lib/supabase';
import { logActivity } from '@/services/activityLogService';

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

    const { data: result, error } = await supabase.rpc('archive_and_reset_property_atomic', {
      payload: {
        propertyId,
        tenantId,
        remarks,
      },
    });

    if (error) {
      throw new Error(`Archive and reset failed: ${error.message}`);
    }

    if (!result || typeof result !== 'object' || !(result as { success?: boolean }).success) {
      throw new Error('Archive and reset returned an invalid response');
    }

    // Log the archive and reset activity
    try {
      await logActivity({
        propertyId,
        tenantId: null,
        actionType: "property_reset",
        description: `Property archived and reset: ${remarks}`,
        metadata: {
          archived_tenant_id: tenantId,
          remarks,
          archived_at: new Date().toISOString(),
        },
      });
    } catch (logError) {
      console.error("Failed to log archive and reset activity:", logError);
      // Don't block archive operation if logging fails
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
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User not authenticated')
    }
    
    const { data, error } = await supabase
      .from('archived_tenants')
      .select('*')
      .eq('landlord_id', user.id)
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
    // Get current user to verify ownership
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User not authenticated')
    }

    const { data, error } = await supabase
      .from('archived_tenants')
      .select('*')
      .eq('property_id', propertyId)
      .eq('landlord_id', user.id)
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
