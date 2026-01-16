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
      // Determine which tenants to insert
      let tenantsToInsert: Array<{
        property_id: string
        tenant_name: string
        email: string
        contact_number: string
        contract_months: number
        rent_start_date: string
        due_day: string
        is_active: boolean
        tenant_slot: number
        created_at: string
        updated_at: string
      }> = []

      if (formData.maxTenants > 1 && formData.tenants.length > 0) {
        // Bed space mode - insert multiple tenants
        formData.tenants.forEach((tenant, index) => {
          // Only insert tenants that have at least a name (partially filled)
          if (tenant.tenantName && tenant.tenantName.trim()) {
            tenantsToInsert.push({
              property_id: property.id,
              tenant_name: tenant.tenantName,
              email: tenant.tenantEmail || '',
              contact_number: tenant.contactNumber || '',
              contract_months: formData.contractMonths,
              rent_start_date: formData.rentStartDate,
              due_day: formData.dueDay,
              is_active: true,
              tenant_slot: index + 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          }
        })
      } else if (formData.tenantName) {
        // Single tenant mode (legacy)
        tenantsToInsert.push({
          property_id: property.id,
          tenant_name: formData.tenantName,
          email: formData.tenantEmail,
          contact_number: formData.contactNumber,
          contract_months: formData.contractMonths,
          rent_start_date: formData.rentStartDate,
          due_day: formData.dueDay,
          is_active: true,
          tenant_slot: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }

      // Insert all tenants
      if (tenantsToInsert.length > 0) {
        const { data: tenantsData, error: tenantsError } = await supabase
          .from('tenants')
          .insert(tenantsToInsert)
          .select()

        if (tenantsError) {
          // Cleanup: Delete the property if tenant insertion fails
          await supabase.from('properties').delete().eq('id', property.id)
          throw new Error(`Tenant insertion failed: ${tenantsError.message}`)
        }

        tenants.push(...(tenantsData || []))

        // 3. Create profile entries for tenants (optional - skip if table doesn't exist)
        for (const tenantData of tenantsData || []) {
          if (tenantData && tenantData.id && tenantData.email) {
            try {
              await supabase
                .from('profiles')
                .insert({
                  email: tenantData.email,
                  full_name: tenantData.tenant_name,
                  phone: tenantData.contact_number,
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
        }

        // 4. Insert Billing Entries (only if occupied and has billing schedule)
        if (formData.billingSchedule.length > 0) {
          // For bed space mode with multiple tenants, calculate fractional billing
          if (formData.maxTenants > 1 && tenants.length > 0) {
            const occupiedSlots = tenants.length
            const totalSlots = formData.maxTenants
            
            // Generate billing entries for each tenant with fractional amount
            const billingRows: any[] = []
            
            for (const tenant of tenants) {
              formData.billingSchedule.forEach((bill, index) => {
                // Calculate fractional rent based on occupied vs total slots
                const fractionalRent = (bill.rentDue / totalSlots)
                const fractionalOtherCharges = (bill.otherCharges / totalSlots)
                const fractionalGross = fractionalRent + fractionalOtherCharges
                
                // Calculate occupancy fraction for status determination
                const occupancyFraction = occupiedSlots / totalSlots
                const fractionStatus = calculateFractionalStatus(bill.status, occupancyFraction)
                
                billingRows.push({
                  property_id: property.id,
                  tenant_id: tenant.id,
                  due_date: new Date(bill.dueDate).toISOString().split('T')[0],
                  rent_due: fractionalRent,
                  other_charges: fractionalOtherCharges,
                  gross_due: fractionalGross,
                  status: fractionStatus,
                  expense_items: JSON.stringify(bill.expenseItems || []),
                  billing_period: index + 1,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
              })
            }

            const { data: billingData, error: billingError } = await supabase
              .from('billing_entries')
              .insert(billingRows)
              .select()

            if (billingError) {
              // Cleanup: Delete tenants and property if billing insertion fails
              for (const tenant of tenants) {
                await supabase.from('tenants').delete().eq('id', tenant.id)
              }
              await supabase.from('properties').delete().eq('id', property.id)
              throw new Error(`Billing entries insertion failed: ${billingError.message}`)
            }

            billingEntries = billingData || []
          } else {
            // Single tenant mode - standard billing
            const billingRows = formData.billingSchedule.map((bill, index) => ({
              property_id: property.id,
              tenant_id: tenants[0]?.id || null,
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
              // Cleanup: Delete tenants and property if billing insertion fails
              for (const tenant of tenants) {
                await supabase.from('tenants').delete().eq('id', tenant.id)
              }
              await supabase.from('properties').delete().eq('id', property.id)
              throw new Error(`Billing entries insertion failed: ${billingError.message}`)
            }

            billingEntries = billingData || []
          }
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

// Helper function to calculate fractional status based on occupancy
function calculateFractionalStatus(baseStatus: string, occupancyFraction: number): string {
  // If property is fully occupied (fraction = 1), use base status
  if (occupancyFraction >= 1) {
    return baseStatus
  }
  
  // If partially occupied, adjust status
  if (baseStatus === 'Paid' || baseStatus === 'paid') {
    if (occupancyFraction >= 0.5) {
      return 'Partially Paid'
    }
    return 'Pending'
  }
  
  // For other statuses, return as-is with occupancy note
  return baseStatus
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