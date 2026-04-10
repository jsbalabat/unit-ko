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

    const webhookPayload = {
      eventType: "tenant_reminder",
      timestamp: new Date().toISOString(),
      tenantName: tenant.tenant_name,
      tenantPhone: tenant.contact_number,
      propertyName: property.unit_name,
      dueDate: billingEntry.due_date,
      amount: Number(billingEntry.gross_due ?? 0),
      message: buildSMSMessage(
        tenant.tenant_name,
        property.unit_name,
        billingEntry.due_date,
        Number(billingEntry.gross_due ?? 0),
      ),
      billingEntryId: billingEntry.id,
    };

    const webhookUrl = getReminderWebhookUrl();
    if (!webhookUrl) {
      return NextResponse.json({ error: "Reminder webhook is not configured" }, { status: 500 });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tenant reminder API error:", error);
    return NextResponse.json({ error: "Failed to send reminder" }, { status: 500 });
  }
}
