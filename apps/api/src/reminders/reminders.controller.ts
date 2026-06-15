import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  recordReminderSchema,
  type RecordReminderInput,
  type ReminderResult,
} from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { RemindersService } from "./reminders.service";

@Controller("reminders")
@UseGuards(SupabaseJwtGuard)
export class RemindersController {
  constructor(private readonly service: RemindersService) {}

  // Records a once-per-day reminder for an invoice. 422 if the tenant's phone is
  // unusable, 429 if already reminded today. SMS dispatch is a separate concern.
  @Post()
  @HttpCode(HttpStatus.CREATED)
  record(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Body(new ZodValidationPipe(recordReminderSchema)) input: RecordReminderInput,
  ): Promise<ReminderResult> {
    return this.service.record(landlord.id, input);
  }
}
