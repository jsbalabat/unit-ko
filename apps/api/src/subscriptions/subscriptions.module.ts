import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { SubscriptionsRepository } from "./subscriptions.repository";

@Module({
  imports: [AuthModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionsRepository],
})
export class SubscriptionsModule {}
