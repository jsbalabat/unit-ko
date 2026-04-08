import { supabase } from '@/lib/supabase'
import type { Property, Tenant, BillingEntry } from '@/lib/supabase'

// Interface for individual tenant in bed space
interface TenantInfo {
  tenantName: string
  tenantEmail: string
  contactNumber: string
}

interface PropertyFormData {
  unitName: string
  propertyType: string
  occupancyStatus: 'occupied' | 'vacant'
  // Legacy single tenant fields (backward compatible)
  tenantName: string
  tenantEmail: string
  contactNumber: string
  pax: number // Same as maxTenants - kept for backward compatibility
  // Bed space fields (pax = maxTenants = number of tenants)
  maxTenants: number
  tenants: TenantInfo[]
  propertyLocation: string
  contractMonths: number // Number of billing periods (not necessarily months - can be weeks, quarters, etc.)
  rentStartDate: string
  dueDay: string
  rentAmount: number
  // Accounting & Monitoring fields
  advancePayment: number
  securityDeposit: number
  leaseDate: string
  billingSchedule: Array<{
    dueDate: string
    rentDue: number
    otherCharges: number
    grossDue: number
    status: string
    expenseItems?: Array<{
      id: string
      name: string
      amount: number
    }>
  }>
}

interface PropertySubmissionResult {
  success: boolean
  data?: {
    property: Property
    tenants?: Tenant[]
    billingEntries?: BillingEntry[]
  }
  error?: string
}


export async function submitPropertyData(formData: PropertyFormData): Promise<PropertySubmissionResult> {
  try {
    const { data, error } = await supabase.rpc('create_property_atomic', {
      payload: formData,
    })

    if (error) {
      throw new Error(`Property submission failed: ${error.message}`)
    }

    if (!data || typeof data !== 'object' || !('property' in data)) {
      throw new Error('Property submission returned invalid response')
    }

    const response = data as {
      property: Property
      tenants?: Tenant[]
      billingEntries?: BillingEntry[]
    }

    return {
      success: true,
      data: {
        property: response.property,
        tenants: response.tenants || [],
        billingEntries: response.billingEntries || []
      }
    }

  } catch (error) {
    console.error('Property submission error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

// Utility function to fetch property with related data
export async function getPropertyWithDetails(propertyId: string) {
  const { data, error } = await supabase
    .from('properties')
    .select(`
      *,
      tenants (
        *,
        billing_entries (*)
      )
    `)
    .eq('id', propertyId)
    .single()

  if (error) {
    throw new Error(`Failed to fetch property: ${error.message}`)
  }

  return data
}