import crypto from "crypto";

const COOKIE_SECRET = process.env.TENANT_SESSION_SECRET;

if (!COOKIE_SECRET) {
  // Keep startup signal explicit so this is configured before production rollout.
  console.warn("TENANT_SESSION_SECRET is not set. Tenant session security is reduced.");
}

export const TENANT_SESSION_COOKIE = "tenant_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

type SessionPayload = {
  tenantId: string;
  exp: number;
};

function getSecret(): string {
  return COOKIE_SECRET || "insecure-dev-fallback-change-this";
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payloadBase64: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(payloadBase64)
    .digest("base64url");
}

export function createTenantSessionToken(tenantId: string): string {
  const payload: SessionPayload = {
    tenantId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  const payloadBase64 = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export function verifyTenantSessionToken(token: string): SessionPayload | null {
  try {
    const [payloadBase64, providedSignature] = token.split(".");
    if (!payloadBase64 || !providedSignature) return null;

    const expectedSignature = sign(payloadBase64);
    const valid = crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expectedSignature),
    );

    if (!valid) return null;

    const parsed = JSON.parse(base64UrlDecode(payloadBase64)) as SessionPayload;
    if (!parsed?.tenantId || !parsed?.exp) return null;

    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function getTenantSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
