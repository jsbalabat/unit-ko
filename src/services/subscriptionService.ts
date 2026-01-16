import { supabase } from '@/lib/supabase'

export interface UserSubscription {
  plan: 'free' | 'basic' | 'premium' | 'enterprise'
  status: 'active' | 'cancelled' | 'expired'
  startDate?: string
  endDate?: string
  lastPaymentDate?: string
  nextBillingDate?: string
  propertyLimit: number
  propertiesUsed: number
}

export interface MonthlyStatement {
  id: string
  month: string
  year: number
  amount: number
  status: 'paid' | 'pending' | 'overdue'
  dueDate: string
  paidDate?: string
  description?: string
}

const PLAN_LIMITS = {
  free: 3,
  basic: 10,
  premium: 50,
  enterprise: 999
}

/**
 * Fetch user's subscription data
 */
export async function fetchUserSubscription(): Promise<UserSubscription | null> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('Error getting user:', authError)
      return null
    }

    // Get profile with subscription data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_plan, subscription_status, subscription_start_date, subscription_end_date, last_payment_date, next_billing_date')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return null
    }

    // Get property count
    const { count, error: countError } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Error counting properties:', countError)
    }

    const plan = (profile?.subscription_plan || 'free') as 'free' | 'basic' | 'premium' | 'enterprise'
    
    return {
      plan,
      status: (profile?.subscription_status || 'active') as 'active' | 'cancelled' | 'expired',
      startDate: profile?.subscription_start_date,
      endDate: profile?.subscription_end_date,
      lastPaymentDate: profile?.last_payment_date,
      nextBillingDate: profile?.next_billing_date,
      propertyLimit: PLAN_LIMITS[plan],
      propertiesUsed: count || 0
    }
  } catch (error) {
    console.error('Error fetching user subscription:', error)
    return null
  }
}

/**
 * Update user's subscription plan
 */
export async function updateSubscriptionPlan(
  plan: 'free' | 'basic' | 'premium' | 'enterprise'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { success: false, error: 'User not authenticated' }
    }

    const now = new Date().toISOString()
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_plan: plan,
        subscription_status: 'active',
        subscription_start_date: now,
        next_billing_date: nextMonth.toISOString(),
        updated_at: now
      })
      .eq('id', user.id)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update subscription'
    }
  }
}

/**
 * Check if user can add more properties based on their plan
 */
export async function canAddProperty(): Promise<{ canAdd: boolean; reason?: string }> {
  try {
    const subscription = await fetchUserSubscription()
    
    if (!subscription) {
      return { canAdd: false, reason: 'Could not fetch subscription data' }
    }

    if (subscription.status !== 'active') {
      return { canAdd: false, reason: 'Your subscription is not active' }
    }

    if (subscription.propertiesUsed >= subscription.propertyLimit) {
      return { 
        canAdd: false, 
        reason: `You've reached your plan limit of ${subscription.propertyLimit} properties. Please upgrade your plan.` 
      }
    }

    return { canAdd: true }
  } catch (error) {
    return { 
      canAdd: false, 
      reason: error instanceof Error ? error.message : 'Error checking property limit'
    }
  }
}

/**
 * Get monthly statements (mock data for now - replace with actual billing data later)
 */
export async function fetchMonthlyStatements(): Promise<MonthlyStatement[]> {
  try {
    const subscription = await fetchUserSubscription()
    
    if (!subscription || subscription.plan === 'free') {
      return [] // Free plan has no statements
    }

    // Mock data - replace with actual billing entries from database
    const currentMonth = new Date()
    const statements: MonthlyStatement[] = []
    
    const planPrices = {
      free: 0,
      basic: 299,
      premium: 799,
      enterprise: 1999
    }

    const price = planPrices[subscription.plan]

    // Generate last 3 months
    for (let i = 0; i < 3; i++) {
      const month = new Date(currentMonth)
      month.setMonth(currentMonth.getMonth() - i)
      
      const dueDate = new Date(month.getFullYear(), month.getMonth() + 1, 0) // Last day of month
      
      statements.push({
        id: `stmt_${month.getFullYear()}_${month.getMonth()}`,
        month: month.toLocaleDateString('en-US', { month: 'long' }),
        year: month.getFullYear(),
        amount: price,
        status: i === 0 ? 'pending' : 'paid',
        dueDate: dueDate.toISOString(),
        paidDate: i > 0 ? new Date(dueDate.getTime() - 86400000).toISOString() : undefined,
        description: `${subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} Plan Subscription`
      })
    }

    return statements
  } catch (error) {
    console.error('Error fetching monthly statements:', error)
    return []
  }
}
