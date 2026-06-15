import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  listBillingQuerySchema,
  type BillingEntry,
  type ListBillingQuery,
} from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { BillingService } from "./billing.service";

@Controller("billing")
@UseGuards(SupabaseJwtGuard)
export class BillingController {
  constructor(private readonly service: BillingService) {}

  // Invoices for one owned property, with derived figures + tenant + charges.
  @Get("entries")
  list(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Query(new ZodValidationPipe(listBillingQuerySchema)) query: ListBillingQuery,
  ): Promise<BillingEntry[]> {
    return this.service.listForProperty(landlord.id, query.propertyId);
  }
}
