import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  createTenantSessionToken,
  getTenantSessionCookieOptions,
  TENANT_SESSION_COOKIE,
} from "@/lib/tenant-session";

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(100),
});

function getSupabaseServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function resolveTenantId(identifier: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("email", identifier)
    .eq("role", "tenant")
    .maybeSingle();

  if (profile?.tenant_id) {
    return profile.tenant_id;
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("contact_number", identifier)
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

    const tenantId = await resolveTenantId(parsed.data.identifier);

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
