interface ReminderPayload {
  tenantName: string
  tenantPhone: string
  propertyName: string
  dueDate: string
  totalAmount: number
  billingEntryId: string
}

export async function sendTenantReminder(payload: ReminderPayload): Promise<{
  success: boolean
  message: string
  alreadySentToday?: boolean
}> {
  try {
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

    if (response.status === 429) {
      return {
        success: false,
        message: 'SMS already sent to this tenant today. Please try again tomorrow.',
        alreadySentToday: true,
      }
    }

    if (!response.ok) {
      throw new Error(`Zapier webhook failed with status ${response.status}`)
    }

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
  return true
}
