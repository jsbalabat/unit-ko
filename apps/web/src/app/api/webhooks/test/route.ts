import { z } from "zod";

type WebhookEvent =
  | "rent_due_today"
  | "payment_submitted"
  | "landlord_confirms_payment";

const querySchema = z.object({
  event: z
    .enum(["rent_due_today", "payment_submitted", "landlord_confirms_payment"])
    .default("rent_due_today"),
});

function getWebhookUrl(event: WebhookEvent): string | undefined {
  if (event === "rent_due_today") return process.env.ZAPIER_RENT_DUE_WEBHOOK;
  if (event === "payment_submitted") return process.env.ZAPIER_PAYMENT_SUBMITTED_WEBHOOK;
  return process.env.ZAPIER_LANDLORD_CONFIRMS_WEBHOOK;
}

function buildTestPayload(event: WebhookEvent) {
  const baseData = {
    billingId: "TEST-" + Date.now(),
    tenantId: "test-tenant",
    tenantName: "Test Tenant",
    propertyName: "Test Property",
    dueDate: new Date().toISOString().split("T")[0],
    grossDue: 15000,
    paidAmount: 5000,
    phone: "09171234567",
  };

  return {
    event,
    timestamp: new Date().toISOString(),
    data: baseData,
  };
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json(
      { error: "Test webhook endpoint is only available in development" },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    event: url.searchParams.get("event") ?? "rent_due_today",
  });

  if (!parsedQuery.success) {
    return Response.json(
      {
        error: "Invalid event. Use one of: rent_due_today, payment_submitted, landlord_confirms_payment",
      },
      { status: 400 }
    );
  }

  const event = parsedQuery.data.event as WebhookEvent;
  const webhookUrl = getWebhookUrl(event);

  if (!webhookUrl || webhookUrl.includes("xxxxx/yyyy")) {
    return Response.json(
      {
        error: `Webhook URL not configured for ${event}. Update your .env.local first.`,
      },
      { status: 400 }
    );
  }

  const testPayload = buildTestPayload(event);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload),
    });

    return Response.json({
      success: response.ok,
      event,
      zapierStatus: response.status,
      payload: testPayload,
    });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}