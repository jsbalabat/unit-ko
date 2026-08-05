import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import {
  activityLogSchema,
  listActivityQuerySchema,
  type ActivityLog,
  type ListActivityQuery,
} from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { zodArraySchema } from "../common/openapi";
import { ActivityService } from "./activity.service";

@ApiTags("activity")
@ApiBearerAuth("landlord-jwt")
@Controller("activity")
@UseGuards(SupabaseJwtGuard)
export class ActivityController {
  constructor(private readonly service: ActivityService) {}

  @Get()
  @ApiQuery({ name: "propertyId", required: false, type: String })
  @ApiQuery({ name: "actionType", required: false, type: String })
  @ApiQuery({ name: "before", required: false, type: String })
  @ApiQuery({ name: "beforeId", required: false, type: String })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiOkResponse({ schema: zodArraySchema(activityLogSchema) })
  list(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Query(new ZodValidationPipe(listActivityQuerySchema)) query: ListActivityQuery,
  ): Promise<ActivityLog[]> {
    return this.service.list(landlord.id, query);
  }
}
