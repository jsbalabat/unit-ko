import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  tenantLoginSchema,
  type TenantLoginDto,
  type TenantLoginResponse,
  type TenantSessionResponse,
} from "@unitko/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import type { AuthenticatedTenant } from "../auth/current-tenant.decorator";
import { TenantSessionGuard } from "../auth/tenant-session.guard";
import {
  getTenantSessionCookieOptions,
  TENANT_SESSION_COOKIE,
} from "../auth/tenant-session";
import { TenantAuthService } from "./tenant-auth.service";

// HTTP boundary only: parse input (Zod), call the service, translate the result
// into cookies + response DTOs. Ports the three legacy Next routes
// (/tenant-auth/login | session | logout) into one controller.
@Controller("tenant-auth")
export class TenantAuthController {
  constructor(private readonly service: TenantAuthService) {}

  @Post("login")
  async login(
    @Body(new ZodValidationPipe(tenantLoginSchema)) dto: TenantLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TenantLoginResponse> {
    const { tenantId, token } = await this.service.login(dto);
    res.cookie(TENANT_SESSION_COOKIE, token, getTenantSessionCookieOptions());
    return { success: true, tenantId };
  }

  @Get("session")
  @UseGuards(TenantSessionGuard)
  async session(
    @CurrentTenant() tenant: AuthenticatedTenant,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TenantSessionResponse> {
    try {
      await this.service.assertStillActive(tenant.id);
    } catch (error) {
      // Cookie is cryptographically valid but the tenant is gone/inactive:
      // clear the stale cookie before propagating the 401.
      res.clearCookie(TENANT_SESSION_COOKIE, { path: "/" });
      throw error;
    }
    return { authenticated: true, tenantId: tenant.id };
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response): { success: true } {
    res.clearCookie(TENANT_SESSION_COOKIE, { path: "/" });
    return { success: true };
  }
}
