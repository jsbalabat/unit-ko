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
  createTenantSchema,
  listTenantsQuerySchema,
  tenantListItemSchema,
  transferTenantResultSchema,
  transferTenantSchema,
  updateTenantSchema,
  type CreateTenantInput,
  type ListTenantsQuery,
  type TenantListItem,
  type TransferTenantInput,
  type TransferTenantResult,
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

  @Post(":id/transfer")
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: zodSchema(transferTenantSchema) })
  @ApiOkResponse({ schema: zodSchema(transferTenantResultSchema) })
  transfer(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(transferTenantSchema)) input: TransferTenantInput,
  ): Promise<TransferTenantResult> {
    return this.service.transfer(landlord.id, id, input);
  }
}
