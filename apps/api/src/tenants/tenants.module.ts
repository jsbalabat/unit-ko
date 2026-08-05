import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantsController } from "./tenants.controller";
import { TenantTransferRequestsController } from "./tenant-transfer-requests.controller";
import { TenantsService } from "./tenants.service";
import { TenantsRepository } from "./tenants.repository";

// AuthModule supplies SupabaseJwtGuard (landlord) + TenantSessionGuard (tenant);
// SupabaseService is global.
@Module({
  imports: [AuthModule],
  controllers: [TenantsController, TenantTransferRequestsController],
  providers: [TenantsService, TenantsRepository],
})
export class TenantsModule {}
