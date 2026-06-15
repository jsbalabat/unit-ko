import { Global, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ActivityController } from "./activity.controller";
import { ActivityService } from "./activity.service";
import { ActivityRepository } from "./activity.repository";

// Global so any service can inject ActivityService.log() (cross-cutting) without
// importing this module everywhere.
@Global()
@Module({
  imports: [AuthModule],
  controllers: [ActivityController],
  providers: [ActivityService, ActivityRepository],
  exports: [ActivityService],
})
export class ActivityModule {}
