import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";
import { TenantsRepository } from "./tenants.repository";

// AuthModule supplies SupabaseJwtGuard; SupabaseService is global.
@Module({
  imports: [AuthModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantsRepository],
})
export class TenantsModule {}
