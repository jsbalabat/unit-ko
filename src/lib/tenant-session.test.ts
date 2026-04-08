import { describe, expect, it } from "vitest";
import {
  createTenantSessionToken,
  getTenantSessionCookieOptions,
  TENANT_SESSION_COOKIE,
  verifyTenantSessionToken,
} from "./tenant-session";

describe("tenant-session", () => {
  it("creates and verifies a tenant session token", () => {
    const token = createTenantSessionToken("tenant-123");

    const payload = verifyTenantSessionToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.tenantId).toBe("tenant-123");
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects tampered tokens", () => {
    const token = createTenantSessionToken("tenant-123");
    const [payload, signature] = token.split(".");
    const tamperedSignature = signature?.slice(0, -1) + (signature?.endsWith("a") ? "b" : "a");
    const tampered = `${payload}.${tamperedSignature}`;

    expect(verifyTenantSessionToken(tampered)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyTenantSessionToken("not-a-token")).toBeNull();
  });

  it("returns secure cookie options", () => {
    const options = getTenantSessionCookieOptions();

    expect(TENANT_SESSION_COOKIE).toBe("tenant_session");
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe("/");
    expect(options.sameSite).toBe("lax");
  });
});
