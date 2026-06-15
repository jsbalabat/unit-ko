import crypto from "crypto";
import { z } from "zod";

// Ported verbatim from the web app's src/lib/tenant-session.ts (the crypto is
// unchanged). It now lives in the API because the API owns session issuance and
// verification. Kept framework-agnostic so it stays trivially unit-testable.
const COOKIE_SECRET = process.env.TENANT_SESSION_SECRET;
const DEV_FALLBACK_SECRET = crypto.randomBytes(32).toString("hex");
let hasWarnedMissingSecret = false;

export const TENANT_SESSION_COOKIE = "tenant_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

const sessionPayloadSchema = z.object({
  tenantId: z.string().trim().min(1),
  exp: z.number().int().positive(),
});

type SessionPayload = z.infer<typeof sessionPayloadSchema>;

function getSecret(): string {
  if (COOKIE_SECRET) {
    return COOKIE_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "TENANT_SESSION_SECRET must be set in production to sign tenant session tokens.",
    );
  }

  if (!hasWarnedMissingSecret) {
    hasWarnedMissingSecret = true;
    console.warn(
      "TENANT_SESSION_SECRET is not set. Using an ephemeral dev secret for this process only.",
    );
  }

  return DEV_FALLBACK_SECRET;
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

    const payloadJson = JSON.parse(base64UrlDecode(payloadBase64));
    const parsedResult = sessionPayloadSchema.safeParse(payloadJson);
    if (!parsedResult.success) return null;

    const parsed = parsedResult.data;

    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;

    return parsed;
  } catch {
    return null;
  }
}

// NOTE: maxAge here is in MILLISECONDS — Express's res.cookie() expects ms,
// whereas the original Next.js cookies.set() expected seconds. Same 24h TTL,
// different unit. Getting this wrong silently expires the cookie ~1000x early.
export function getTenantSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS * 1000,
  };
}
