import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import {
  assignTenantSchema,
  createTenantSchema,
  listTenantsQuerySchema,
  tenantListItemSchema,
  transferRequestSchema,
  transferTenantSchema,
  updateTenantSchema,
  type AssignTenantInput,
  type CreateTenantInput,
  type ListTenantsQuery,
  type TenantListItem,
  type TransferRequest,
  type TransferTenantInput,
  type UpdateTenantInput,
} from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { zodArraySchema, zodSchema } from "../common/openapi";
import { TenantsService } from "./tenants.service";

// Landlord-scoped tenant management. Identity comes from the verified JWT.
@ApiTags("tenants")
@ApiBearerAuth("landlord-jwt")
@Controller("tenants")
@UseGuards(SupabaseJwtGuard)
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Get()
  @ApiQuery({ name: "assigned", required: false, enum: ["true", "false"] })
  @ApiOkResponse({ schema: zodArraySchema(tenantListItemSchema) })
  list(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Query(new ZodValidationPipe(listTenantsQuerySchema)) query: ListTenantsQuery,
  ): Promise<TenantListItem[]> {
    return this.service.list(landlord.id, query.assigned);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ schema: zodSchema(createTenantSchema) })
  @ApiCreatedResponse({ schema: zodSchema(tenantListItemSchema) })
  create(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Body(new ZodValidationPipe(createTenantSchema)) input: CreateTenantInput,
  ): Promise<TenantListItem> {
    return this.service.create(landlord.id, input);
  }

  @Patch(":id")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: zodSchema(updateTenantSchema) })
  @ApiOkResponse({ schema: zodSchema(tenantListItemSchema) })
  update(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateTenantSchema)) input: UpdateTenantInput,
  ): Promise<TenantListItem> {
    return this.service.update(landlord.id, id, input);
  }

  // Propose a transfer for the tenant to confirm — nothing moves yet. Returns the
  // pending request.
  @Post(":id/transfer")
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: zodSchema(transferTenantSchema) })
  @ApiOkResponse({ schema: zodSchema(transferRequestSchema) })
  proposeTransfer(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(transferTenantSchema)) input: TransferTenantInput,
  ): Promise<TransferRequest> {
    return this.service.proposeTransfer(landlord.id, id, input);
  }

  // Pending proposals across the landlord's tenants, so the directory can flag them.
  @Get("transfer-requests")
  @ApiOkResponse({ schema: zodArraySchema(transferRequestSchema) })
  listTransferRequests(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
  ): Promise<TransferRequest[]> {
    return this.service.listPendingTransferRequests(landlord.id);
  }

  @Post("transfer-requests/:id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOkResponse({ schema: zodSchema(transferRequestSchema) })
  cancelTransferRequest(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<TransferRequest> {
    return this.service.cancelTransferRequest(landlord.id, id);
  }

  @Post(":id/assign")
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: zodSchema(assignTenantSchema) })
  @ApiOkResponse({ schema: zodSchema(tenantListItemSchema) })
  assign(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(assignTenantSchema)) input: AssignTenantInput,
  ): Promise<TenantListItem> {
    return this.service.assign(landlord.id, id, input);
  }
}
