import { supabase } from '@/lib/supabase'
import type { Tenant } from '@/lib/supabase'

export interface CreateTenantInput {
  tenantName: string
  tenantEmail?: string
  contactNumber: string
  propertyId?: string | null // omit / null / '' for an unhoused tenant
}

export interface CreateTenantResult {
  success: boolean
  tenant?: Tenant
  error?: string
}

/**
 * Create a tenant. If `propertyId` is provided, the RPC validates landlord
 * ownership, picks the next free tenant_slot, and flips the property to
 * 'occupied' if it was vacant. Otherwise the tenant is created without an
 * assignment (NULL property_id, NULL lease fields) and can be assigned later.
 */
export async function createTenant(
  input: CreateTenantInput,
): Promise<CreateTenantResult> {
  try {
    const { data, error } = await supabase.rpc('create_unhoused_tenant_atomic', {
      payload: {
        tenantName: input.tenantName.trim(),
        tenantEmail: input.tenantEmail?.trim() ?? '',
        contactNumber: input.contactNumber.trim(),
        propertyId: input.propertyId?.trim() || '',
      },
    })

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to create tenant',
      }
    }

    if (!data || typeof data !== 'object' || !('tenant' in data)) {
      return {
        success: false,
        error: 'Tenant creation returned invalid response',
      }
    }

    return {
      success: true,
      tenant: (data as { tenant: Tenant }).tenant,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

export interface TenantListRow {
  id: string
  tenant_name: string
  email: string | null
  contact_number: string
  property_id: string | null
  is_active: boolean
  created_at: string
  property_unit_name: string | null
}

/**
 * List every tenant the current landlord owns, with their property's unit name
 * (or null when unassigned). Sorted: unassigned first, then by property name.
 */
export async function listLandlordTenants(): Promise<TenantListRow[]> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error(userError?.message ?? 'Not authenticated')
  }

  const { data, error } = await supabase
    .from('tenants')
    .select(`
      id,
      tenant_name,
      email,
      contact_number,
      property_id,
      is_active,
      created_at,
      properties:property_id (
        unit_name
      )
    `)
    .eq('landlord_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  type RawRow = {
    id: string
    tenant_name: string
    email: string | null
    contact_number: string
    property_id: string | null
    is_active: boolean
    created_at: string
    properties: { unit_name: string } | { unit_name: string }[] | null
  }

  const rows = (data ?? []) as RawRow[]

  return rows
    .map((row) => {
      const propertyJoin = Array.isArray(row.properties)
        ? row.properties[0] ?? null
        : row.properties
      return {
        id: row.id,
        tenant_name: row.tenant_name,
        email: row.email,
        contact_number: row.contact_number,
        property_id: row.property_id,
        is_active: row.is_active,
        created_at: row.created_at,
        property_unit_name: propertyJoin?.unit_name ?? null,
      }
    })
    .sort((a, b) => {
      // Unassigned first, then alphabetic by property name.
      if (a.property_unit_name === null && b.property_unit_name !== null) return -1
      if (a.property_unit_name !== null && b.property_unit_name === null) return 1
      if (a.property_unit_name && b.property_unit_name) {
        return a.property_unit_name.localeCompare(b.property_unit_name)
      }
      return a.tenant_name.localeCompare(b.tenant_name)
    })
}

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
    id: string
    landlord_id: string
    unit_name: string
    property_type: string
    property_location: string
    rent_amount: number
  }
  billingEntries: {
    id: string
    period_id?: string
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
 * Authenticate tenant by matching both email and contact number
 */
export async function authenticateTenant(email: string, contactNumber: string): Promise<string | null> {
  try {
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedContact = contactNumber.trim()

    // First, resolve tenant by email in profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .ilike('email', normalizedEmail)
      .eq('role', 'tenant')
      .maybeSingle()

    if (profile && profile.tenant_id) {
      const { data: tenantByProfile } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', profile.tenant_id)
        .eq('contact_number', normalizedContact)
        .eq('is_active', true)
        .maybeSingle()

      if (tenantByProfile?.id) {
        return tenantByProfile.id
      }
    }

    // Fallback: validate against tenant row email + contact number
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .ilike('email', normalizedEmail)
      .eq('contact_number', normalizedContact)
      .eq('is_active', true)
      .maybeSingle()

    if (tenant) {
      return tenant.id
    }

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
      .select('id, landlord_id, unit_name, property_type, property_location, rent_amount')
      .eq('id', tenant.property_id)
      .single()

    if (propertyError || !property) {
      console.error('Error fetching property:', propertyError)
      return null
    }

    // 3. Fetch billing entries
    const { data: billingEntries, error: billingError } = await supabase
      .from('billing_entries')
      .select('id, period_id, due_date, rent_due, other_charges, gross_due, status, billing_period')
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
        id: property.id,
        landlord_id: property.landlord_id,
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
