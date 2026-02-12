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
  contractMonths: number
  rentStartDate: string
  dueDay: string
  rentAmount: number
  // Accounting & Monitoring fields
  advancePayment: number
  securityDeposit: number
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
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User not authenticated')
    }
    
    // Start a transaction-like approach by inserting in order
    
    // 1. Insert Property with bed space support
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .insert({
        landlord_id: user.id,
        unit_name: formData.unitName,
        property_type: formData.propertyType,
        occupancy_status: formData.occupancyStatus,
        property_location: formData.propertyLocation,
        rent_amount: formData.rentAmount,
        max_tenants: formData.maxTenants || 1,
        bed_space_billing_mode: formData.maxTenants > 1 ? 'per_tenant' : 'unified',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (propertyError) {
      throw new Error(`Property insertion failed: ${propertyError.message}`)
    }

    const tenants: Tenant[] = []
    let billingEntries: BillingEntry[] = []

    // 2. Insert Tenants (only if occupied)
    if (formData.occupancyStatus === 'occupied') {
      // Build pax_details array from tenant information
      const paxDetails = []
      
      if (formData.maxTenants > 1 && formData.tenants.length > 0) {
        // Multiple occupants - create pax_details from tenants array
        formData.tenants.forEach((tenant) => {
          if (tenant.tenantName && tenant.tenantName.trim()) {
            paxDetails.push({
              name: tenant.tenantName,
              email: tenant.tenantEmail || '',
              phone: tenant.contactNumber || ''
            })
          }
        })
      } else if (formData.tenantName) {
        // Single occupant - create pax_details from tenant fields
        paxDetails.push({
          name: formData.tenantName,
          email: formData.tenantEmail || '',
          phone: formData.contactNumber || ''
        })
      }

      // Only create tenant if we have at least one person
      if (paxDetails.length > 0) {
        const firstTenant = paxDetails[0]
        
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .insert({
            property_id: property.id,
            tenant_name: firstTenant.name,
            contact_number: firstTenant.phone || '',
            pax: paxDetails.length,
            pax_details: paxDetails,
            contract_months: formData.contractMonths,
            rent_start_date: formData.rentStartDate,
            due_day: formData.dueDay,
            is_active: true,
            advance_payment: formData.advancePayment || 0,
            security_deposit: formData.securityDeposit || 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (tenantError) {
          // Cleanup: Delete the property if tenant insertion fails
          await supabase.from('properties').delete().eq('id', property.id)
          throw new Error(`Tenant insertion failed: ${tenantError.message}`)
        }

        tenants.push(tenantData)

        // 3. Create profile entry for tenant (optional - skip if table doesn't exist)
        if (tenantData && tenantData.id && firstTenant.email) {
          try {
            await supabase
              .from('profiles')
              .insert({
                email: firstTenant.email,
                full_name: mainTenant.name,
                phone: mainTenant.phone,
                role: 'tenant',
                tenant_id: tenantData.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
          } catch (profileError) {
            // Log the error but continue - profile creation is optional until migration is run
            console.warn('Profile creation skipped (table may not exist yet):', profileError)
          }
        }

        // 4. Insert Billing Entries (only if occupied and has billing schedule)
        if (formData.billingSchedule.length > 0) {
          // Create billing entries for the single tenant record
          const billingRows = formData.billingSchedule.map((bill, index) => ({
            property_id: property.id,
            tenant_id: tenantData.id,
            due_date: new Date(bill.dueDate).toISOString().split('T')[0],
            rent_due: bill.rentDue,
            other_charges: bill.otherCharges,
            gross_due: bill.grossDue,
            status: bill.status,
            expense_items: JSON.stringify(bill.expenseItems || []),
            billing_period: index + 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }))

          const { data: billingData, error: billingError } = await supabase
            .from('billing_entries')
            .insert(billingRows)
            .select()

          if (billingError) {
            // Cleanup: Delete tenant and property if billing insertion fails
            await supabase.from('tenants').delete().eq('id', tenantData.id)
            await supabase.from('properties').delete().eq('id', property.id)
            throw new Error(`Billing entries insertion failed: ${billingError.message}`)
          }

          billingEntries = billingData || []
        }
      }
    }

    return {
      success: true,
      data: {
        property,
        tenants,
        billingEntries
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