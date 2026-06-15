import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { TENANT_SESSION_COOKIE, verifyTenantSessionToken } from "@/lib/tenant-session";

const cookieValueSchema = z.string().trim().min(1).max(4096);

function getSupabaseServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const rawCookieValue = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${TENANT_SESSION_COOKIE}=`))
    ?.slice(TENANT_SESSION_COOKIE.length + 1);

  const cookieValueParsed = cookieValueSchema.safeParse(rawCookieValue);
  const cookieValue = cookieValueParsed.success ? cookieValueParsed.data : null;

  if (!cookieValue) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const payload = verifyTenantSessionToken(cookieValue);
  if (!payload?.tenantId) {
    const response = NextResponse.json({ authenticated: false }, { status: 401 });
    response.cookies.delete(TENANT_SESSION_COOKIE);
    return response;
  }

  const supabase = getSupabaseServerClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, is_active")
    .eq("id", payload.tenantId)
    .eq("is_active", true)
    .maybeSingle();

  if (!tenant) {
    const response = NextResponse.json({ authenticated: false }, { status: 401 });
    response.cookies.delete(TENANT_SESSION_COOKIE);
    return response;
  }

  return NextResponse.json({ authenticated: true, tenantId: payload.tenantId });
}
