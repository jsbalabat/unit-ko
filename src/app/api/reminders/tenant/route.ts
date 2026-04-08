import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";

const reminderSchema = z.object({
  eventType: z.literal("tenant_reminder"),
  timestamp: z.string().datetime(),
  tenantName: z.string().trim().min(1).max(200),
  tenantPhone: z.string().trim().min(5).max(40),
  propertyName: z.string().trim().min(1).max(200),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().finite().nonnegative(),
  message: z.string().trim().min(1).max(500),
  billingEntryId: z.string().trim().min(1).max(100),
});

function getReminderWebhookUrl(): string | null {
  return process.env.ZAPIER_TENANT_REMINDER_WEBHOOK || null;
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

    const webhookUrl = getReminderWebhookUrl();
    if (!webhookUrl) {
      return NextResponse.json({ error: "Reminder webhook is not configured" }, { status: 500 });
    }

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
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
