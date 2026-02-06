import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface PersonDetail {
  name: string
  email: string
  phone: string
}

interface PropertyWithTenant {
  id: string
  unit_name: string
  property_type: string
  occupancy_status: 'occupied' | 'vacant'
  property_location: string
  rent_amount: number
  created_at: string
  tenants: Array<{
    id: string
    tenant_name: string
    contact_number: string
    pax?: number
    pax_details?: PersonDetail[]
    is_active: boolean
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
      
      // Fetch only properties belonging to the current landlord
      const { data, error } = await supabase
        .from('properties')
        .select(`
          id,
          landlord_id,
          unit_name,
          property_type,
          occupancy_status,
          property_location,
          rent_amount,
          created_at,
          tenants (
            id,
            tenant_name,
            contact_number,
            pax,
            pax_details,
            is_active
          )
        `)
        .eq('landlord_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Properties fetch error:', error)
        throw error
      }

      const propertiesData = data || []
      setProperties(propertiesData)

      // Calculate stats
      const totalProperties = propertiesData.length
      const activeRentals = propertiesData.filter(p => p.occupancy_status === 'occupied').length
      const vacantProperties = propertiesData.filter(p => p.occupancy_status === 'vacant').length
      const totalRevenue = propertiesData
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