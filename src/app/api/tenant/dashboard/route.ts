import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { TENANT_SESSION_COOKIE, verifyTenantSessionToken } from "@/lib/tenant-session";

function getSupabaseServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function getCookieValue(cookieHeader: string, name: string): string | null {
  const entry = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!entry) return null;
  return entry.slice(name.length + 1);
}

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookie = getCookieValue(cookieHeader, TENANT_SESSION_COOKIE);

  if (!cookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = verifyTenantSessionToken(cookie);
  if (!payload?.tenantId) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    response.cookies.delete(TENANT_SESSION_COOKIE);
    return response;
  }

  const supabase = getSupabaseServerClient();

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id, tenant_name, email, contact_number, contract_months, rent_start_date, due_day, property_id")
    .eq("id", payload.tenantId)
    .eq("is_active", true)
    .single();

  if (tenantError || !tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, landlord_id, unit_name, property_type, property_location, rent_amount")
    .eq("id", tenant.property_id)
    .single();

  if (propertyError || !property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const { data: billingEntries, error: billingError } = await supabase
    .from("billing_entries")
    .select("id, due_date, rent_due, other_charges, gross_due, status, billing_period")
    .eq("tenant_id", tenant.id)
    .order("due_date", { ascending: true });

  if (billingError) {
    return NextResponse.json({ error: "Failed to fetch billing entries" }, { status: 500 });
  }

  return NextResponse.json({
    tenant: {
      id: tenant.id,
      tenant_name: tenant.tenant_name,
      email: tenant.email,
      contact_number: tenant.contact_number,
      contract_months: tenant.contract_months,
      rent_start_date: tenant.rent_start_date,
      due_day: tenant.due_day,
    },
    property: {
      id: property.id,
      landlord_id: property.landlord_id,
      unit_name: property.unit_name,
      property_type: property.property_type,
      property_location: property.property_location,
      rent_amount: property.rent_amount,
    },
    billingEntries: billingEntries || [],
  });
}
