import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

export interface AuthenticatedTenant {
  id: string;
}

// Reads the tenant identity that TenantSessionGuard placed on the request.
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedTenant => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.tenant) {
      throw new UnauthorizedException("Not authenticated as a tenant");
    }
    return req.tenant;
  },
);
