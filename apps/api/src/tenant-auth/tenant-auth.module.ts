import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TenantAuthController } from "./tenant-auth.controller";
import { TenantAuthService } from "./tenant-auth.service";
import { TenantAuthRepository } from "./tenant-auth.repository";

// AuthModule supplies TenantSessionGuard; SupabaseService is global.
@Module({
  imports: [AuthModule],
  controllers: [TenantAuthController],
  providers: [TenantAuthService, TenantAuthRepository],
})
export class TenantAuthModule {}
