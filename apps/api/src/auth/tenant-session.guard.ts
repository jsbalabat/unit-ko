import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { z } from "zod";
import type { Request } from "express";
import {
  TENANT_SESSION_COOKIE,
  verifyTenantSessionToken,
} from "./tenant-session";

const cookieValueSchema = z.string().trim().min(1).max(4096);

// Verifies the tenant's HMAC session cookie and attaches { id } to the request.
// This is the cryptographic check only (signature + expiry). Whether the tenant
// is still active is a data concern checked in the service layer, so the guard
// stays fast and dependency-free.
@Injectable()
export class TenantSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.cookies?.[TENANT_SESSION_COOKIE];

    const parsed = cookieValueSchema.safeParse(raw);
    if (!parsed.success) {
      throw new UnauthorizedException("Missing tenant session");
    }

    const payload = verifyTenantSessionToken(parsed.data);
    if (!payload?.tenantId) {
      throw new UnauthorizedException("Invalid tenant session");
    }

    req.tenant = { id: payload.tenantId };
    return true;
  }
}
