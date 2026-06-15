import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  listActivityQuerySchema,
  type ActivityLog,
  type ListActivityQuery,
} from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ActivityService } from "./activity.service";

@Controller("activity")
@UseGuards(SupabaseJwtGuard)
export class ActivityController {
  constructor(private readonly service: ActivityService) {}

  @Get()
  list(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Query(new ZodValidationPipe(listActivityQuerySchema)) query: ListActivityQuery,
  ): Promise<ActivityLog[]> {
    return this.service.list(landlord.id, query);
  }
}
