import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  recordReminderSchema,
  reminderLogSchema,
  reminderResultSchema,
  type RecordReminderInput,
  type ReminderLog,
  type ReminderResult,
} from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { zodArraySchema, zodSchema } from "../common/openapi";
import { RemindersService } from "./reminders.service";

@ApiTags("reminders")
@ApiBearerAuth("landlord-jwt")
@Controller("reminders")
@UseGuards(SupabaseJwtGuard)
export class RemindersController {
  constructor(private readonly service: RemindersService) {}

  // Sends a once-per-day rent reminder for an invoice via Zapier, on the requested
  // channel (default email). 422 if the tenant has no usable address for that
  // channel, 429 if that channel already reminded today — email and SMS are
  // throttled independently. A failed dispatch still returns 201 with status
  // 'failed' — the outcome, not an error.
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ schema: zodSchema(recordReminderSchema) })
  @ApiCreatedResponse({ schema: zodSchema(reminderResultSchema) })
  record(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Body(new ZodValidationPipe(recordReminderSchema)) input: RecordReminderInput,
  ): Promise<ReminderResult> {
    return this.service.record(landlord.id, input);
  }

  // Recent reminders across the landlord's portfolio (newest first) for the
  // dashboard cycle feed. Optional ?limit (default 10, capped at 50).
  @Get()
  @ApiOkResponse({ schema: zodArraySchema(reminderLogSchema) })
  list(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Query("limit") limit?: string,
  ): Promise<ReminderLog[]> {
    return this.service.listRecent(
      landlord.id,
      limit ? Number(limit) : undefined,
    );
  }
}
