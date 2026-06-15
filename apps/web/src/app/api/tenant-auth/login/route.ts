import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  createTenantSessionToken,
  getTenantSessionCookieOptions,
  TENANT_SESSION_COOKIE,
} from "@/lib/tenant-session";

const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  contactNumber: z.string().trim().min(5).max(40),
});

function getSupabaseServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function resolveTenantIdByCredentials(
  email: string,
  contactNumber: string,
): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedContact = contactNumber.trim();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .ilike("email", normalizedEmail)
    .eq("role", "tenant")
    .maybeSingle();

  if (profile?.tenant_id) {
    const { data: profiledTenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", profile.tenant_id)
      .eq("contact_number", normalizedContact)
      .eq("is_active", true)
      .maybeSingle();

    if (profiledTenant?.id) {
      return profiledTenant.id;
    }
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .ilike("email", normalizedEmail)
    .eq("contact_number", normalizedContact)
    .eq("is_active", true)
    .maybeSingle();

  return tenant?.id ?? null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid login payload" },
        { status: 400 },
      );
    }

    const tenantId = await resolveTenantIdByCredentials(
      parsed.data.email,
      parsed.data.contactNumber,
    );

    if (!tenantId) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = createTenantSessionToken(tenantId);
    const response = NextResponse.json({ success: true });
    response.cookies.set(TENANT_SESSION_COOKIE, token, getTenantSessionCookieOptions());

    return response;
  } catch (error) {
    console.error("Tenant login API error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
