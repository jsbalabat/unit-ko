import { Module } from "@nestjs/common";
import { SupabaseJwtGuard } from "./supabase-jwt.guard";
import { TenantSessionGuard } from "./tenant-session.guard";

// Provides the two guards as injectables so feature modules can reference them
// by class in @UseGuards(). Import AuthModule wherever a controller is guarded.
@Module({
  providers: [SupabaseJwtGuard, TenantSessionGuard],
  exports: [SupabaseJwtGuard, TenantSessionGuard],
})
export class AuthModule {}
