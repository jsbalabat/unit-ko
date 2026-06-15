import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  recordPaymentSchema,
  type RecordPaymentInput,
  type RecordPaymentResult,
} from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PaymentsService } from "./payments.service";

@Controller("payments")
@UseGuards(SupabaseJwtGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  record(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Body(new ZodValidationPipe(recordPaymentSchema)) input: RecordPaymentInput,
  ): Promise<RecordPaymentResult> {
    return this.service.record(landlord.id, input);
  }
}
