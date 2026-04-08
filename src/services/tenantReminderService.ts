import { logActivity } from "@/services/activityLogService";

interface ReminderPayload {
  tenantName: string
  tenantPhone: string
  propertyName: string
  dueDate: string
  totalAmount: number
  billingEntryId: string
}

interface RateLimitKey {
  billingEntryId: string
  date: string
}

// Generate a rate limit key for today
const getRateLimitKey = (billingEntryId: string): RateLimitKey => {
  const today = new Date().toISOString().split('T')[0]
  return { billingEntryId, date: today }
}

// Get rate limit status from localStorage
const checkRateLimit = (billingEntryId: string): boolean => {
  if (typeof window === 'undefined') return true // Skip check on server

  const key = getRateLimitKey(billingEntryId)
  const keyStr = `sms_reminder_${key.billingEntryId}_${key.date}`
  
  const lastSent = localStorage.getItem(keyStr)
  return !lastSent // Return true if NOT sent yet today (meaning we can send)
}

// Mark as sent in localStorage
const setRateLimitFlag = (billingEntryId: string): void => {
  if (typeof window === 'undefined') return // Skip on server

  const key = getRateLimitKey(billingEntryId)
  const keyStr = `sms_reminder_${key.billingEntryId}_${key.date}`
  
  localStorage.setItem(keyStr, new Date().toISOString())
}

// Format date for SMS message
const formatDateForMessage = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// Build SMS message
const buildSMSMessage = (
  tenantName: string,
  propertyName: string,
  dueDate: string,
  totalAmount: number
): string => {
  const formattedDate = formatDateForMessage(dueDate)
  const amount = totalAmount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  return `Hi ${tenantName}, your rent for ${propertyName} is due on ${formattedDate} with a total amount of ₱${amount}. Please settle your account. Thank you!`
}

export async function sendTenantReminder(payload: ReminderPayload): Promise<{
  success: boolean
  message: string
  alreadySentToday?: boolean
}> {
  try {
    // Check rate limit
    if (!checkRateLimit(payload.billingEntryId)) {
      return {
        success: false,
        message: 'SMS already sent to this tenant today. Please try again tomorrow.',
        alreadySentToday: true
      }
    }

    // Build SMS message
    const smsMessage = buildSMSMessage(
      payload.tenantName,
      payload.propertyName,
      payload.dueDate,
      payload.totalAmount
    )

    // Send through backend so webhook URL remains server-side.
    const response = await fetch('/api/reminders/tenant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        eventType: 'tenant_reminder',
        timestamp: new Date().toISOString(),
        tenantName: payload.tenantName,
        tenantPhone: payload.tenantPhone,
        propertyName: payload.propertyName,
        dueDate: payload.dueDate,
        amount: payload.totalAmount,
        message: smsMessage,
        billingEntryId: payload.billingEntryId
      })
    })

    if (!response.ok) {
      throw new Error(`Zapier webhook failed with status ${response.status}`)
    }

    // Mark as sent in localStorage (rate limit flag)
    setRateLimitFlag(payload.billingEntryId)

    await logActivity({
      actionType: "tenant_reminder_sent",
      description: `SMS reminder sent to ${payload.tenantName}`,
      metadata: {
        tenant_phone: payload.tenantPhone,
        property_name: payload.propertyName,
        due_date: payload.dueDate,
        amount: payload.totalAmount,
        billing_entry_id: payload.billingEntryId,
      },
    });

    return {
      success: true,
      message: 'SMS reminder sent successfully to ' + payload.tenantName
    }
  } catch (error) {
    console.error('Error sending tenant reminder:', error)
    return {
      success: false,
      message: error instanceof Error 
        ? error.message 
        : 'Failed to send SMS. Please try again.'
    }
  }
}

// Check if SMS can be sent today for a specific billing entry
export function canSendReminderToday(billingEntryId: string): boolean {
  return checkRateLimit(billingEntryId)
}
