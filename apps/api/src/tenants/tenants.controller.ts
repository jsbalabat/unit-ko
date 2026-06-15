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
  createTenantSchema,
  listTenantsQuerySchema,
  updateTenantSchema,
  type CreateTenantInput,
  type ListTenantsQuery,
  type TenantListItem,
  type UpdateTenantInput,
} from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { TenantsService } from "./tenants.service";

// Landlord-scoped tenant management. Identity comes from the verified JWT.
@Controller("tenants")
@UseGuards(SupabaseJwtGuard)
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Get()
  list(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Query(new ZodValidationPipe(listTenantsQuerySchema)) query: ListTenantsQuery,
  ): Promise<TenantListItem[]> {
    return this.service.list(landlord.id, query.assigned);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Body(new ZodValidationPipe(createTenantSchema)) input: CreateTenantInput,
  ): Promise<TenantListItem> {
    return this.service.create(landlord.id, input);
  }

  @Patch(":id")
  update(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateTenantSchema)) input: UpdateTenantInput,
  ): Promise<TenantListItem> {
    return this.service.update(landlord.id, id, input);
  }
}
