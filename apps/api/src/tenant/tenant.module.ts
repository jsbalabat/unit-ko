import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BillingModule } from "../billing/billing.module";
import { TenantDashboardController } from "./tenant-dashboard.controller";
import { TenantDashboardService } from "./tenant-dashboard.service";
import { TenantDashboardRepository } from "./tenant-dashboard.repository";

// AuthModule supplies TenantSessionGuard; BillingModule supplies BillingService
// for the tenant's invoice list.
@Module({
  imports: [AuthModule, BillingModule],
  controllers: [TenantDashboardController],
  providers: [TenantDashboardService, TenantDashboardRepository],
})
export class TenantModule {}
