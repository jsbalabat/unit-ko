import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const getSupabaseConfigError = (): string | null => {
  const missingVars: string[] = []

  if (!supabaseUrl) {
    missingVars.push('NEXT_PUBLIC_SUPABASE_URL')
  }

  if (!supabaseAnonKey) {
    missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  if (missingVars.length === 0) {
    return null
  }

  return `Supabase configuration is missing: ${missingVars.join(', ')}. Set these values in .env.local.`
}

// Create a browser client with proper auth persistence
export const supabase = createBrowserClient(
  supabaseUrl ?? 'https://invalid-project-ref.supabase.co',
  supabaseAnonKey ?? 'invalid-anon-key'
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
  landlord_id: string
  property_id: string | null // NULL for unhoused tenants awaiting assignment
  tenant_name: string
  email: string
  contact_number: string
  tenant_slot?: number // Bed space slot number
  contract_months: number | null // NULL for unhoused tenants
  billing_frequency?: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly' | 'semi-annually' | 'annually'
  rent_per_person?: number
  rent_start_date: string | null // NULL for unhoused tenants
  due_day: string | null // NULL for unhoused tenants
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
  period_id?: string
  due_date: string
  rent_due: number
  other_charges: number
  gross_due: number
  status: string
  billing_period: number
  paid_amount?: number // Amount already paid for this entry
  expense_items?: string // JSON string of expense breakdown
  last_reminded_at?: string | null
  created_at: string
  updated_at: string
}