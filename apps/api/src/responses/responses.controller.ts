import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { tenantResponseSchema, type TenantResponse } from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { zodArraySchema, zodSchema } from "../common/openapi";
import { ResponsesService } from "./responses.service";

// Landlord-facing: behind the Supabase JWT, the landlord id comes from the
// verified token. Ownership of each response is enforced in the service.
@ApiTags("responses")
@ApiBearerAuth("landlord-jwt")
@Controller("responses")
@UseGuards(SupabaseJwtGuard)
export class ResponsesController {
  constructor(private readonly service: ResponsesService) {}

  // Tenant responses across the landlord's portfolio (newest first) for the
  // Quick Access panel. Optional ?limit (default 10, capped at 50).
  @Get()
  @ApiOkResponse({ schema: zodArraySchema(tenantResponseSchema) })
  list(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Query("limit") limit?: string,
  ): Promise<TenantResponse[]> {
    return this.service.listForLandlord(
      landlord.id,
      limit ? Number(limit) : undefined,
    );
  }

  // Stamp receipt of a tenant's response. 404 when the response isn't the
  // landlord's, so confirmation can't touch another landlord's data.
  @Post(":id/confirm")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ schema: zodSchema(tenantResponseSchema) })
  confirm(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<TenantResponse> {
    return this.service.confirmForLandlord(landlord.id, id);
  }
}
