import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface PropertyWithTenant {
  id: string
  unit_name: string
  property_type: string
  occupancy_status: 'occupied' | 'vacant'
  property_location: string
  rent_amount: number
  max_tenants?: number
  created_at: string
  tenants: Array<{
    id: string
    tenant_name: string
    email?: string
    contact_number: string
    is_active: boolean
    billing_entries?: Array<{
      id: string
      property_id: string
      tenant_id: string | null
      period_id?: string
      due_date: string
      status: string
      billing_period: number
      paid_amount?: number
      gross_due: number
    }>
  }>
}

interface PropertyStats {
  totalProperties: number
  activeRentals: number
  vacantProperties: number
  totalRevenue: number
}

export function useProperties() {
  const [properties, setProperties] = useState<PropertyWithTenant[]>([])
  const [stats, setStats] = useState<PropertyStats>({
    totalProperties: 0,
    activeRentals: 0,
    vacantProperties: 0,
    totalRevenue: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProperties = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        console.error('User authentication error:', userError)
        throw new Error('Failed to get user: ' + userError.message)
      }
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      console.log('Fetching properties for user:', user.id)
      
      // Fetch only properties and tenant details first (billing entries are loaded separately).
      const { data: propertiesDataRaw, error: propertiesError } = await supabase
        .from('properties')
        .select(`
          id,
          landlord_id,
          unit_name,
          property_type,
          occupancy_status,
          property_location,
          rent_amount,
          max_tenants,
          created_at,
          tenants (
            id,
            tenant_name,
            email,
            contact_number,
            is_active
          )
        `)
        .eq('landlord_id', user.id)
        .order('created_at', { ascending: false })

      if (propertiesError) {
        console.error('Properties fetch error:', propertiesError)
        throw propertiesError
      }

      const propertiesData = (propertiesDataRaw || []) as PropertyWithTenant[]

      const propertyIds = propertiesData.map((property) => property.id)

      const { data: billingRows, error: billingError } = propertyIds.length
        ? await supabase
            .from('billing_entries')
            .select(`
              id,
              property_id,
              tenant_id,
              period_id,
              due_date,
              status,
              billing_period,
              paid_amount,
              gross_due
            `)
            .in('property_id', propertyIds)
            .order('due_date', { ascending: true })
        : { data: [], error: null }

      if (billingError) {
        console.error('Billing entries fetch error:', billingError)
        throw billingError
      }

      const billingEntriesByTenantId = new Map<string, typeof billingRows>()
      ;(billingRows || []).forEach((entry) => {
        if (!entry.tenant_id) return

        const existing = billingEntriesByTenantId.get(entry.tenant_id) || []
        existing.push(entry)
        billingEntriesByTenantId.set(entry.tenant_id, existing)
      })

      const hydratedProperties = propertiesData.map((property) => ({
        ...property,
        tenants: (property.tenants || []).map((tenant) => ({
          ...tenant,
          billing_entries: billingEntriesByTenantId.get(tenant.id) || [],
        })),
      }))

      const propertiesDataFinal = hydratedProperties
      
      setProperties(propertiesDataFinal)

      // Calculate stats
      const totalProperties = propertiesDataFinal.length
      const activeRentals = propertiesDataFinal.filter(p => p.occupancy_status === 'occupied').length
      const vacantProperties = propertiesDataFinal.filter(p => p.occupancy_status === 'vacant').length
      const totalRevenue = propertiesDataFinal
        .filter(p => p.occupancy_status === 'occupied')
        .reduce((sum, p) => sum + p.rent_amount, 0)

      setStats({
        totalProperties,
        activeRentals,
        vacantProperties,
        totalRevenue
      })
      
      setError(null)
    } catch (err) {
      console.error('Error in fetchProperties:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch properties')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProperties()
  }, [])

  return {
    properties,
    stats,
    loading,
    error,
    refetch: fetchProperties
  }
}