import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

export interface AuthenticatedLandlord {
  id: string;
  email?: string;
}

// Reads the landlord identity that SupabaseJwtGuard placed on the request.
// Throws if used on a route that isn't behind the guard — a programming error,
// surfaced loudly rather than handing a handler `undefined`.
export const CurrentLandlord = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedLandlord => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.landlord) {
      throw new UnauthorizedException("Not authenticated as a landlord");
    }
    return req.landlord;
  },
);
