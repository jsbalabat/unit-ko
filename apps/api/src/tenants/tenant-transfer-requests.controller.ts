import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  resolveTransferRequestSchema,
  transferRequestSchema,
  type ResolveTransferRequestInput,
  type TransferRequest,
} from "@unitko/shared";
import { TenantSessionGuard } from "../auth/tenant-session.guard";
import { CurrentTenant } from "../auth/current-tenant.decorator";
import type { AuthenticatedTenant } from "../auth/current-tenant.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { zodSchema } from "../common/openapi";
import { TenantsService } from "./tenants.service";

// Tenant-facing: behind the HMAC session cookie, the tenant id comes from the
// verified cookie (never the request). The tenant sees the transfer their landlord
// proposed and confirms or rejects it.
@ApiTags("tenant")
@ApiCookieAuth("tenant-session")
@Controller("tenant/transfer-request")
@UseGuards(TenantSessionGuard)
export class TenantTransferRequestsController {
  constructor(private readonly service: TenantsService) {}

  // The tenant's own pending proposal, or null.
  @Get()
  @ApiOkResponse({ schema: zodSchema(transferRequestSchema) })
  get(
    @CurrentTenant() tenant: AuthenticatedTenant,
  ): Promise<TransferRequest | null> {
    return this.service.getPendingTransferForTenant(tenant.id);
  }

  // Confirm (moves the tenant) or reject the proposal. 404 if it isn't theirs.
  @Post(":id/resolve")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: zodSchema(resolveTransferRequestSchema) })
  @ApiOkResponse({ schema: zodSchema(transferRequestSchema) })
  resolve(
    @CurrentTenant() tenant: AuthenticatedTenant,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(resolveTransferRequestSchema))
    input: ResolveTransferRequestInput,
  ): Promise<TransferRequest> {
    return this.service.resolveTransferForTenant(tenant.id, id, input.confirm);
  }
}
