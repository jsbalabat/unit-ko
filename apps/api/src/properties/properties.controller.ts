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
  UseGuards,
} from "@nestjs/common";
import {
  createPropertySchema,
  updatePropertySchema,
  type CreatePropertyInput,
  type PropertyDetail,
  type PropertySummary,
  type UpdatePropertyInput,
} from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PropertiesService } from "./properties.service";

// All property routes require a verified landlord JWT. The landlord id comes
// from the token (never the request), and every query is scoped to it.
@Controller("properties")
@UseGuards(SupabaseJwtGuard)
export class PropertiesController {
  constructor(private readonly service: PropertiesService) {}

  @Get()
  list(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
  ): Promise<PropertySummary[]> {
    return this.service.listForLandlord(landlord.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Body(new ZodValidationPipe(createPropertySchema)) input: CreatePropertyInput,
  ): Promise<PropertyDetail> {
    return this.service.create(landlord.id, input);
  }

  @Get(":id")
  detail(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<PropertyDetail> {
    return this.service.getDetailForLandlord(landlord.id, id);
  }

  @Patch(":id")
  update(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePropertySchema)) input: UpdatePropertyInput,
  ): Promise<PropertyDetail> {
    return this.service.update(landlord.id, id, input);
  }
}
