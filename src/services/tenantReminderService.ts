import { supabase } from "@/lib/supabase";
import { logActivity } from "@/services/activityLogService";

interface ReminderPayload {
  tenantName: string
  tenantPhone: string
  propertyName: string
  dueDate: string
  totalAmount: number
  billingEntryId: string
  propertyId?: string
  tenantId?: string
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

    // Lookup billing entry to get propertyId and tenantId if not provided
    let propertyId = payload.propertyId;
    let tenantId = payload.tenantId;

    if (!propertyId || !tenantId) {
      const { data: billingEntry, error: billingError } = await supabase
        .from("billing_entries")
        .select("property_id, tenant_id")
        .eq("id", payload.billingEntryId)
        .single();

      if (billingError || !billingEntry) {
        console.error("Failed to lookup billing entry for activity log:", billingError);
        // Continue anyway - don't block reminder send if lookup fails
      } else {
        propertyId = propertyId || billingEntry.property_id;
        tenantId = tenantId || billingEntry.tenant_id;
      }
    }

    // Send through backend so webhook URL remains server-side and payload is rebuilt from trusted DB data.
    const response = await fetch('/api/reminders/tenant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        eventType: 'tenant_reminder',
        timestamp: new Date().toISOString(),
        billingEntryId: payload.billingEntryId
      })
    })

    if (!response.ok) {
      throw new Error(`Zapier webhook failed with status ${response.status}`)
    }

    // Mark as sent in localStorage (rate limit flag)
    setRateLimitFlag(payload.billingEntryId)

    await logActivity({
      propertyId,
      tenantId,
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
