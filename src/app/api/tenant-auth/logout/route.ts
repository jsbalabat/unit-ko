import { NextResponse } from "next/server";
import { TENANT_SESSION_COOKIE } from "@/lib/tenant-session";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(TENANT_SESSION_COOKIE);
  return response;
}
