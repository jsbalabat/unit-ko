import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  createTenantResponseSchema,
  tenantResponseSchema,
  type CreateTenantResponseInput,
  type TenantResponse,
} from "@unitko/shared";
import { TenantSessionGuard } from "../auth/tenant-session.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import type { AuthenticatedTenant } from "../auth/current-tenant.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { zodArraySchema, zodSchema } from "../common/openapi";
import { ResponsesService } from "./responses.service";

// Tenant-facing: behind the HMAC session cookie, the tenant id comes from the
// verified cookie (never the request).
@ApiTags("tenant")
@ApiCookieAuth("tenant-session")
@Controller("tenant/responses")
@UseGuards(TenantSessionGuard)
export class TenantResponsesController {
  constructor(private readonly service: ResponsesService) {}

  // Acknowledge one of the tenant's own bills with a response type (+ optional
  // note). 404 if the bill isn't theirs (checked in the service).
  @Post()
  @ApiBody({ schema: zodSchema(createTenantResponseSchema) })
  @ApiCreatedResponse({ schema: zodSchema(tenantResponseSchema) })
  create(
    @CurrentTenant() tenant: AuthenticatedTenant,
    @Body(new ZodValidationPipe(createTenantResponseSchema))
    input: CreateTenantResponseInput,
  ): Promise<TenantResponse> {
    return this.service.createForTenant(tenant.id, input);
  }

  // The tenant's own responses (newest first), so the dashboard can show which
  // bills they've acknowledged and whether the landlord confirmed receipt.
  @Get()
  @ApiOkResponse({ schema: zodArraySchema(tenantResponseSchema) })
  list(
    @CurrentTenant() tenant: AuthenticatedTenant,
    @Query("limit") limit?: string,
  ): Promise<TenantResponse[]> {
    return this.service.listForTenant(
      tenant.id,
      limit ? Number(limit) : undefined,
    );
  }
}
