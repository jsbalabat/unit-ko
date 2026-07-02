import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  recordReminderSchema,
  reminderResultSchema,
  type RecordReminderInput,
  type ReminderResult,
} from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { zodSchema } from "../common/openapi";
import { RemindersService } from "./reminders.service";

@ApiTags("reminders")
@ApiBearerAuth("landlord-jwt")
@Controller("reminders")
@UseGuards(SupabaseJwtGuard)
export class RemindersController {
  constructor(private readonly service: RemindersService) {}

  // Sends a once-per-day rent reminder for an invoice (email-first via Zapier).
  // 422 if the tenant has no usable email, 429 if already reminded today. A failed
  // dispatch still returns 201 with status 'failed' — the outcome, not an error.
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
}
