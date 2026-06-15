import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PropertiesController } from "./properties.controller";
import { PropertiesService } from "./properties.service";
import { PropertiesRepository } from "./properties.repository";

// AuthModule supplies SupabaseJwtGuard; SupabaseService is global.
@Module({
  imports: [AuthModule],
  controllers: [PropertiesController],
  providers: [PropertiesService, PropertiesRepository],
})
export class PropertiesModule {}
