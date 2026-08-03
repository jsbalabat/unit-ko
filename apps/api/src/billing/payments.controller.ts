import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
  recordPaymentResultSchema,
  recordPaymentSchema,
  voidPaymentResultSchema,
  voidPaymentSchema,
  type RecordPaymentInput,
  type RecordPaymentResult,
  type VoidPaymentInput,
  type VoidPaymentResult,
} from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { zodSchema } from "../common/openapi";
import { PaymentsService } from "./payments.service";

@ApiTags("payments")
@ApiBearerAuth("landlord-jwt")
@Controller("payments")
@UseGuards(SupabaseJwtGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ schema: zodSchema(recordPaymentSchema) })
  @ApiCreatedResponse({ schema: zodSchema(recordPaymentResultSchema) })
  record(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Body(new ZodValidationPipe(recordPaymentSchema)) input: RecordPaymentInput,
  ): Promise<RecordPaymentResult> {
    return this.service.record(landlord.id, input);
  }

  @Post(":batchId/void")
  @HttpCode(HttpStatus.OK)
  @ApiBody({ schema: zodSchema(voidPaymentSchema) })
  @ApiOkResponse({ schema: zodSchema(voidPaymentResultSchema) })
  voidPayment(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("batchId", new ParseUUIDPipe()) batchId: string,
    @Body(new ZodValidationPipe(voidPaymentSchema)) input: VoidPaymentInput,
  ): Promise<VoidPaymentResult> {
    return this.service.voidPayment(landlord.id, batchId, input);
  }
}
