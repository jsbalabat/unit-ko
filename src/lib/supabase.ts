import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a browser client with proper auth persistence
export const supabase = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey
)

// Database types for TypeScript
export interface Property {
  id: string
  landlord_id: string
  unit_name: string
  property_type: string
  occupancy_status: 'occupied' | 'vacant'
  property_location: string
  rent_amount: number
  max_tenants?: number // Bed space support
  bed_space_billing_mode?: string // 'unified' or 'per_tenant'
  lease_date?: string // Optional lease/contract date
  notes?: string // JSON array of notes
  created_at: string
  updated_at: string
}

export interface Tenant {
  id: string
  property_id: string
  tenant_name: string
  email: string
  contact_number: string
  pax?: number
  pax_details?: Array<{
    name: string
    email: string
    phone: string
  }> // JSONB array of individual person details
  tenant_slot?: number // Bed space slot number
  contract_months: number // Number of billing periods (can be weekly, monthly, quarterly, semi-annually, or annually)
  billing_frequency?: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'semi-annually' | 'annually'
  rent_per_person?: number
  rent_start_date: string
  due_day: string
  is_active: boolean
  advance_payment?: number // Accounting field
  security_deposit?: number // Accounting field
  overflow?: number // Payment overflow/credit
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  username: string | null
  phone: string | null
  role: 'landlord' | 'tenant'
  tenant_id: string | null
  created_at: string
  updated_at: string
}

export interface BillingEntry {
  id: string
  property_id: string
  tenant_id: string | null
  due_date: string
  rent_due: number
  other_charges: number
  gross_due: number
  status: string
  billing_period: number
  paid_amount?: number // Amount already paid for this entry
  expense_items?: string // JSON string of expense breakdown
  tenant_payments?: string // JSON string of per-tenant payment tracking: {"0": 1500, "1": 1500}
  tenant_rent_amounts?: string // JSON string of per-tenant rent: {"0": 5000, "1": 6000}
  tenant_other_charges?: string // JSON string of per-tenant charges: {"0": 200, "1": 300}
  created_at: string
  updated_at: string
}