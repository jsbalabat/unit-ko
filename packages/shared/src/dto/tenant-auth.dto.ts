import { z } from "zod";

// Tenant login: email + contact number (the custom HMAC-session flow). These
// are the only credentials a tenant has — there is no password. The API
// resolves them to a tenant row and issues a signed session cookie.
export const tenantLoginSchema = z.object({
  email: z.string().trim().email().max(200),
  contactNumber: z.string().trim().min(5).max(40),
});
export type TenantLoginDto = z.infer<typeof tenantLoginSchema>;

// Returned by POST /tenant-auth/login on success. The session token itself is
// set as an httpOnly cookie, never sent in the body.
export const tenantLoginResponseSchema = z.object({
  success: z.literal(true),
  tenantId: z.string().uuid(),
});
export type TenantLoginResponse = z.infer<typeof tenantLoginResponseSchema>;

// Returned by GET /tenant-auth/session when the cookie is valid and the tenant
// is still active. A 401 (no body contract) means "not authenticated".
export const tenantSessionResponseSchema = z.object({
  authenticated: z.literal(true),
  tenantId: z.string().uuid(),
});
export type TenantSessionResponse = z.infer<typeof tenantSessionResponseSchema>;
