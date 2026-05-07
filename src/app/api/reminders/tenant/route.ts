import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";

const reminderSchema = z.object({
  eventType: z.literal("tenant_reminder"),
  timestamp: z.string().datetime().optional(),
  billingEntryId: z.string().trim().min(1).max(100),
});

function getReminderWebhookUrl(): string | null {
  return process.env.ZAPIER_TENANT_REMINDER_WEBHOOK || null;
}

function formatDateForMessage(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildSMSMessage(
  tenantName: string,
  propertyName: string,
  dueDate: string,
  totalAmount: number,
): string {
  const formattedDate = formatDateForMessage(dueDate);
  const amount = totalAmount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `Hi ${tenantName}, your rent for ${propertyName} is due on ${formattedDate} with a total amount of ₱${amount}. Please settle your account. Thank you!`;
}

function normalizePhoneToE164(phone: string): string | null {
  const digitsOnly = phone.replace(/\D/g, "");

  // Already E.164 format for PH (+639xxxxxxxxx).
  if (/^\+639\d{9}$/.test(phone.trim())) {
    return phone.trim();
  }

  // Common PH local formats.
  if (/^09\d{9}$/.test(digitsOnly)) {
    return `+63${digitsOnly.slice(1)}`;
  }

  if (/^9\d{9}$/.test(digitsOnly)) {
    return `+63${digitsOnly}`;
  }

  if (/^639\d{9}$/.test(digitsOnly)) {
    return `+${digitsOnly}`;
  }

  return null;
}

function getStartOfTodayIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = reminderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid reminder payload" }, { status: 400 });
    }

    const { data: billingEntry, error: billingError } = await supabase
      .from("billing_entries")
      .select("id, property_id, tenant_id, due_date, gross_due")
      .eq("id", parsed.data.billingEntryId)
      .single();

    if (billingError || !billingEntry) {
      return NextResponse.json({ error: "Billing entry not found" }, { status: 404 });
    }

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, landlord_id, unit_name")
      .eq("id", billingEntry.property_id)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    if (property.landlord_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, tenant_name, contact_number")
      .eq("id", billingEntry.tenant_id)
      .eq("property_id", property.id)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const tenantPhoneE164 = normalizePhoneToE164(tenant.contact_number ?? "");
    if (!tenantPhoneE164) {
      return NextResponse.json(
        {
          error:
            "Tenant contact number must be a valid PH mobile number (e.g. +639XXXXXXXXX or 09XXXXXXXXX).",
        },
        { status: 422 },
      );
    }

    const message = buildSMSMessage(
      tenant.tenant_name,
      property.unit_name,
      billingEntry.due_date,
      Number(billingEntry.gross_due ?? 0),
    );

    const webhookPayload = {
      eventType: "tenant_reminder",
      timestamp: new Date().toISOString(),
      tenantName: tenant.tenant_name,
      tenantPhone: tenant.contact_number,
      tenantPhoneE164,
      propertyName: property.unit_name,
      dueDate: billingEntry.due_date,
      amount: Number(billingEntry.gross_due ?? 0),
      message,
      // UniSMS-ready aliases for easier Zap mapping.
      recipient: tenantPhoneE164,
      content: message,
      billingEntryId: billingEntry.id,
    };

    const webhookUrl = getReminderWebhookUrl();
    if (!webhookUrl) {
      return NextResponse.json({ error: "Reminder webhook is not configured" }, { status: 500 });
    }

    const claimTimestamp = new Date().toISOString();
    const startOfTodayIso = getStartOfTodayIso();

    const { data: claimResult, error: claimError } = await supabase
      .from("billing_entries")
      .update({ last_reminded_at: claimTimestamp })
      .eq("id", billingEntry.id)
      .or(`last_reminded_at.is.null,last_reminded_at.lt.${startOfTodayIso}`)
      .select("id")
      .maybeSingle();

    if (claimError) {
      return NextResponse.json({ error: "Failed to reserve reminder slot" }, { status: 500 });
    }

    if (!claimResult) {
      return NextResponse.json(
        { error: "SMS reminder already sent today for this billing period." },
        { status: 429 },
      );
    }

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
      return NextResponse.json(
        { error: `Webhook call failed with status ${webhookResponse.status}` },
        { status: 502 },
      );
    }

    const { error: logError } = await supabase.from("activity_logs").insert({
      property_id: property.id,
      tenant_id: tenant.id,
      user_id: user.id,
      action_type: "tenant_reminder_sent",
      description: `SMS reminder sent to ${tenant.tenant_name}`,
      metadata: {
        tenant_phone: tenant.contact_number,
        tenant_phone_e164: tenantPhoneE164,
        property_name: property.unit_name,
        due_date: billingEntry.due_date,
        amount: Number(billingEntry.gross_due ?? 0),
        billing_entry_id: billingEntry.id,
        reminder_claimed_at: claimTimestamp,
      },
      created_at: claimTimestamp,
    });

    if (logError) {
      console.error("Failed to write tenant reminder activity log:", logError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tenant reminder API error:", error);
    return NextResponse.json({ error: "Failed to send reminder" }, { status: 500 });
  }
}
