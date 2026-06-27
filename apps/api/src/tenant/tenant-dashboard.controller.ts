import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { tenantDashboardSchema, type TenantDashboard } from "@unitko/shared";
import { TenantSessionGuard } from "../auth/tenant-session.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import type { AuthenticatedTenant } from "../auth/current-tenant.decorator";
import { zodSchema } from "../common/openapi";
import { TenantDashboardService } from "./tenant-dashboard.service";

// Tenant-facing: behind the HMAC session cookie, the tenant id comes from the
// verified cookie (never the request).
@ApiTags("tenant")
@ApiCookieAuth("tenant-session")
@Controller("tenant")
@UseGuards(TenantSessionGuard)
export class TenantDashboardController {
  constructor(private readonly service: TenantDashboardService) {}

  @Get("dashboard")
  @ApiOkResponse({ schema: zodSchema(tenantDashboardSchema) })
  dashboard(
    @CurrentTenant() tenant: AuthenticatedTenant,
  ): Promise<TenantDashboard> {
    return this.service.getDashboard(tenant.id);
  }
}
