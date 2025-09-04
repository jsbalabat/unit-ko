import { supabase } from '@/lib/supabase'
import type { Property, Tenant, BillingEntry } from '@/lib/supabase'

interface PropertyFormData {
  unitName: string
  propertyType: string
  occupancyStatus: 'occupied' | 'vacant'
  tenantName: string
  contactNumber: string
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
    expenseItems?: Array<{  // Add this property
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
    tenant?: Tenant
    billingEntries?: BillingEntry[]
  }
  error?: string
}

export async function submitPropertyData(formData: PropertyFormData): Promise<PropertySubmissionResult> {
  try {
    // Start a transaction-like approach by inserting in order
    
    // 1. Insert Property
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .insert({
        unit_name: formData.unitName,
        property_type: formData.propertyType,
        occupancy_status: formData.occupancyStatus,
        property_location: formData.propertyLocation,
        rent_amount: formData.rentAmount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (propertyError) {
      throw new Error(`Property insertion failed: ${propertyError.message}`)
    }

    let tenant: Tenant | undefined
    let billingEntries: BillingEntry[] = []

    // 2. Insert Tenant (only if occupied)
    if (formData.occupancyStatus === 'occupied' && formData.tenantName) {
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          property_id: property.id,
          tenant_name: formData.tenantName,
          contact_number: formData.contactNumber,
          contract_months: formData.contractMonths,
          rent_start_date: formData.rentStartDate,
          due_day: formData.dueDay,
          is_active: true,
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

      tenant = tenantData

      // 3. Insert Billing Entries (only if occupied and has billing schedule)
      if (formData.billingSchedule.length > 0) {
        const billingRows = formData.billingSchedule.map((bill, index) => ({
          property_id: property.id,
          tenant_id: tenant!.id,
          due_date: new Date(bill.dueDate).toISOString().split('T')[0],
          rent_due: bill.rentDue,
          other_charges: bill.otherCharges,
          gross_due: bill.grossDue,
          status: bill.status,
          expense_items: JSON.stringify(bill.expenseItems), // Store as JSON string
          billing_period: index + 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))

        const { data: billingData, error: billingError } = await supabase
          .from('billing_entries')
          .insert(billingRows)
          .select()

        if (billingError) {
          // Cleanup: Delete property and tenant if billing insertion fails
          if (tenant) {
            await supabase.from('tenants').delete().eq('id', tenant.id)
          }
          await supabase.from('properties').delete().eq('id', property.id)
          throw new Error(`Billing entries insertion failed: ${billingError.message}`)
        }

        billingEntries = billingData || []
      }
    }

    return {
      success: true,
      data: {
        property,
        tenant,
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