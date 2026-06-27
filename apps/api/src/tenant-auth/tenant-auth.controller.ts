import { Body, Controller, Get, Post, Res, UseGuards } from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  tenantLoginResponseSchema,
  tenantLoginSchema,
  tenantSessionResponseSchema,
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
import { zodSchema } from "../common/openapi";
import { TenantAuthService } from "./tenant-auth.service";

// HTTP boundary only: parse input (Zod), call the service, translate the result
// into cookies + response DTOs. Ports the three legacy Next routes
// (/tenant-auth/login | session | logout) into one controller.
@ApiTags("tenant-auth")
@Controller("tenant-auth")
export class TenantAuthController {
  constructor(private readonly service: TenantAuthService) {}

  @Post("login")
  @ApiBody({ schema: zodSchema(tenantLoginSchema) })
  @ApiOkResponse({ schema: zodSchema(tenantLoginResponseSchema) })
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
  @ApiCookieAuth("tenant-session")
  @ApiOkResponse({ schema: zodSchema(tenantSessionResponseSchema) })
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
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: { success: { type: "boolean", example: true } },
    },
  })
  logout(@Res({ passthrough: true }) res: Response): { success: true } {
    res.clearCookie(TENANT_SESSION_COOKIE, { path: "/" });
    return { success: true };
  }
}
