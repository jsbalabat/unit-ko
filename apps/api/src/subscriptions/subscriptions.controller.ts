import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  subscriptionPlanInfoSchema,
  subscriptionSchema,
  updateSubscriptionSchema,
  type Subscription,
  type SubscriptionPlanInfo,
  type UpdateSubscriptionInput,
} from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { zodArraySchema, zodSchema } from "../common/openapi";
import { SubscriptionsService } from "./subscriptions.service";

@ApiTags("subscription")
@ApiBearerAuth("landlord-jwt")
@Controller("subscription")
@UseGuards(SupabaseJwtGuard)
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get()
  @ApiOkResponse({ schema: zodSchema(subscriptionSchema) })
  current(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
  ): Promise<Subscription> {
    return this.service.getForLandlord(landlord.id);
  }

  @Get("plans")
  @ApiOkResponse({ schema: zodArraySchema(subscriptionPlanInfoSchema) })
  plans(): Promise<SubscriptionPlanInfo[]> {
    return this.service.listPlans();
  }

  @Put()
  @ApiBody({ schema: zodSchema(updateSubscriptionSchema) })
  @ApiOkResponse({ schema: zodSchema(subscriptionSchema) })
  update(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Body(new ZodValidationPipe(updateSubscriptionSchema))
    input: UpdateSubscriptionInput,
  ): Promise<Subscription> {
    return this.service.updatePlan(landlord.id, input);
  }
}
