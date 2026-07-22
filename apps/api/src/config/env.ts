import { z } from "zod";

// 12-Factor: every piece of configuration comes from the environment and is
// validated once at boot. An invalid/missing var fails fast and loud rather
// than surfacing as a confusing runtime error deep in a request.
export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Landlord tokens are verified via the project's JWKS endpoint (asymmetric
  // ES256), derived from SUPABASE_URL — no shared JWT secret needed.

  // Optional here so unit tests and local dev can run without it; the tenant
  // session module enforces its presence in production. A present-but-blank
  // value in .env (`TENANT_SESSION_SECRET=`) is treated as unset, not as "".
  TENANT_SESSION_SECRET: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().min(1).optional(),
  ),

  // The Zapier catch-hooks the reminder dispatcher POSTs to — one per channel,
  // because the email Zap and the SMS Zap are different actions with different
  // downstream providers. Both optional so the API boots without them; when the
  // hook for a channel is unset, a reminder on that channel is recorded as
  // 'failed' rather than sent. A present-but-blank value is treated as unset.
  ZAPIER_RENT_DUE_WEBHOOK: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().url().optional(),
  ),
  ZAPIER_RENT_DUE_SMS_WEBHOOK: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().url().optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;

// Passed to ConfigModule.forRoot({ validate }). Throwing here aborts bootstrap.
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
