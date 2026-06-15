import { Controller, Get, UseGuards } from "@nestjs/common";
import type { TenantDashboard } from "@unitko/shared";
import { TenantSessionGuard } from "../auth/tenant-session.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import type { AuthenticatedTenant } from "../auth/current-tenant.decorator";
import { TenantDashboardService } from "./tenant-dashboard.service";

// Tenant-facing: behind the HMAC session cookie, the tenant id comes from the
// verified cookie (never the request).
@Controller("tenant")
@UseGuards(TenantSessionGuard)
export class TenantDashboardController {
  constructor(private readonly service: TenantDashboardService) {}

  @Get("dashboard")
  dashboard(
    @CurrentTenant() tenant: AuthenticatedTenant,
  ): Promise<TenantDashboard> {
    return this.service.getDashboard(tenant.id);
  }
}
