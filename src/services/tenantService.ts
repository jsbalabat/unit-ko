import { supabase } from '@/lib/supabase'

export interface TenantDashboardData {
  tenant: {
    id: string
    tenant_name: string
    email: string
    contact_number: string
    contract_months: number
    rent_start_date: string
    due_day: string
  }
  property: {
    unit_name: string
    property_type: string
    property_location: string
    rent_amount: number
  }
  billingEntries: {
    id: string
    due_date: string
    rent_due: number
    other_charges: number
    gross_due: number
    status: string
    billing_period: number
  }[]
}

/**
 * Authenticate tenant by email only
 */
export async function authenticateTenantByEmail(email: string): Promise<string | null> {
  try {
    // Check if email exists in profiles with tenant role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('email', email)
      .eq('role', 'tenant')
      .single()

    if (profileError || !profile || !profile.tenant_id) {
      return null
    }

    return profile.tenant_id
  } catch (error) {
    console.error('Error authenticating tenant:', error)
    return null
  }
}

/**
 * Authenticate tenant by email or contact number
 */
export async function authenticateTenant(identifier: string): Promise<string | null> {
  try {
    // First, try to authenticate by email (check profiles table)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('email', identifier)
      .eq('role', 'tenant')
      .maybeSingle()

    // If found in profiles by email, return tenant_id
    if (profile && profile.tenant_id) {
      return profile.tenant_id
    }

    // If not found by email, try to find by contact number in tenants table
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('contact_number', identifier)
      .eq('is_active', true)
      .maybeSingle()

    if (tenant) {
      return tenant.id
    }

    // Not found by either method
    return null
  } catch (error) {
    console.error('Error authenticating tenant:', error)
    return null
  }
}

/**
 * Fetch tenant dashboard data including property and billing info
 */
export async function fetchTenantDashboardData(tenantId: string): Promise<TenantDashboardData | null> {
  try {
    // 1. Fetch tenant details
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, tenant_name, email, contact_number, contract_months, rent_start_date, due_day, property_id')
      .eq('id', tenantId)
      .eq('is_active', true)
      .single()

    if (tenantError || !tenant) {
      console.error('Error fetching tenant:', tenantError)
      return null
    }

    // 2. Fetch property details
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('unit_name, property_type, property_location, rent_amount')
      .eq('id', tenant.property_id)
      .single()

    if (propertyError || !property) {
      console.error('Error fetching property:', propertyError)
      return null
    }

    // 3. Fetch billing entries
    const { data: billingEntries, error: billingError } = await supabase
      .from('billing_entries')
      .select('id, due_date, rent_due, other_charges, gross_due, status, billing_period')
      .eq('tenant_id', tenantId)
      .order('due_date', { ascending: true })

    if (billingError) {
      console.error('Error fetching billing entries:', billingError)
      return null
    }

    return {
      tenant: {
        id: tenant.id,
        tenant_name: tenant.tenant_name,
        email: tenant.email,
        contact_number: tenant.contact_number,
        contract_months: tenant.contract_months,
        rent_start_date: tenant.rent_start_date,
        due_day: tenant.due_day,
      },
      property: {
        unit_name: property.unit_name,
        property_type: property.property_type,
        property_location: property.property_location,
        rent_amount: property.rent_amount,
      },
      billingEntries: billingEntries || [],
    }
  } catch (error) {
    console.error('Error fetching tenant dashboard data:', error)
    return null
  }
}
