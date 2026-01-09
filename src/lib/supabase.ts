import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types for TypeScript
export interface Property {
  id: string
  landlord_id: string
  unit_name: string
  property_type: string
  occupancy_status: 'occupied' | 'vacant'
  property_location: string
  rent_amount: number
  created_at: string
  updated_at: string
}

export interface Tenant {
  id: string
  property_id: string
  tenant_name: string
  email: string
  contact_number: string
  contract_months: number
  rent_start_date: string
  due_day: string
  is_active: boolean
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
  created_at: string
  updated_at: string
}