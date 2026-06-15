import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/env";
import { SupabaseModule } from "./supabase/supabase.module";
import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { TenantAuthModule } from "./tenant-auth/tenant-auth.module";
import { PropertiesModule } from "./properties/properties.module";
import { TenantsModule } from "./tenants/tenants.module";
import { BillingModule } from "./billing/billing.module";

@Module({
  imports: [
    // Loads .env and validates the whole environment once at boot (fail-fast).
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    SupabaseModule,
    AuthModule,
    HealthModule,
    TenantAuthModule,
    PropertiesModule,
    TenantsModule,
    BillingModule,
  ],
})
export class AppModule {}
