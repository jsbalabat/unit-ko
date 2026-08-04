import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import {
  billingEntrySchema,
  billingRevisionSchema,
  leaseCreditSchema,
  listBillingQuerySchema,
  paymentAllocationSchema,
  updateBillingEntrySchema,
  type BillingEntry,
  type BillingRevision,
  type LeaseCredit,
  type ListBillingQuery,
  type PaymentAllocation,
  type UpdateBillingEntryInput,
} from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { zodArraySchema, zodSchema } from "../common/openapi";
import { BillingService } from "./billing.service";

@ApiTags("billing")
@ApiBearerAuth("landlord-jwt")
@Controller("billing")
@UseGuards(SupabaseJwtGuard)
export class BillingController {
  constructor(private readonly service: BillingService) {}

  // Invoices for one owned property, with derived figures + tenant + charges.
  @Get("entries")
  @ApiQuery({ name: "propertyId", required: true, type: String })
  @ApiOkResponse({ schema: zodArraySchema(billingEntrySchema) })
  list(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Query(new ZodValidationPipe(listBillingQuerySchema)) query: ListBillingQuery,
  ): Promise<BillingEntry[]> {
    return this.service.listForProperty(landlord.id, query.propertyId);
  }

  // Edit one invoice (rent/charges/due date); status is recomputed server-side.
  @Patch("entries/:id")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: zodSchema(updateBillingEntrySchema) })
  @ApiOkResponse({ schema: zodSchema(billingEntrySchema) })
  update(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateBillingEntrySchema))
    input: UpdateBillingEntryInput,
  ): Promise<BillingEntry> {
    return this.service.updateEntry(landlord.id, id, input);
  }

  // Durable edit history for one owned invoice (newest first).
  @Get("entries/:id/revisions")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOkResponse({ schema: zodArraySchema(billingRevisionSchema) })
  listRevisions(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<BillingRevision[]> {
    return this.service.listRevisions(landlord.id, id);
  }

  // Payments applied to one owned invoice (newest first), for the history drawer.
  @Get("entries/:id/payments")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOkResponse({ schema: zodArraySchema(paymentAllocationSchema) })
  listPayments(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<PaymentAllocation[]> {
    return this.service.listPayments(landlord.id, id);
  }

  // A lease's overpayment credit (pool / applied / available). Zeroed for a lease
  // the landlord doesn't own, so it never leaks another landlord's figures.
  @Get("leases/:leaseId/credit")
  @ApiParam({ name: "leaseId", format: "uuid" })
  @ApiOkResponse({ schema: zodSchema(leaseCreditSchema) })
  leaseCredit(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("leaseId", ParseUUIDPipe) leaseId: string,
  ): Promise<LeaseCredit> {
    return this.service.getLeaseCredit(landlord.id, leaseId);
  }
}
