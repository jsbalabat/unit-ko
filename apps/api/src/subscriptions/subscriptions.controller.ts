import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import {
  updateSubscriptionSchema,
  type Subscription,
  type SubscriptionPlanInfo,
  type UpdateSubscriptionInput,
} from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { SubscriptionsService } from "./subscriptions.service";

@Controller("subscription")
@UseGuards(SupabaseJwtGuard)
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get()
  current(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
  ): Promise<Subscription> {
    return this.service.getForLandlord(landlord.id);
  }

  @Get("plans")
  plans(): Promise<SubscriptionPlanInfo[]> {
    return this.service.listPlans();
  }

  @Put()
  update(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Body(new ZodValidationPipe(updateSubscriptionSchema))
    input: UpdateSubscriptionInput,
  ): Promise<Subscription> {
    return this.service.updatePlan(landlord.id, input);
  }
}
