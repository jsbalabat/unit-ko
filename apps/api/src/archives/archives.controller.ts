import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  archivePropertySchema,
  archiveResultSchema,
  archivedTenantSchema,
  type ArchivePropertyInput,
  type ArchiveResult,
  type ArchivedTenant,
} from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { zodArraySchema, zodSchema } from "../common/openapi";
import { ArchivesService } from "./archives.service";

@ApiTags("archives")
@ApiBearerAuth("landlord-jwt")
@Controller("archives")
@UseGuards(SupabaseJwtGuard)
export class ArchivesController {
  constructor(private readonly service: ArchivesService) {}

  @Get()
  @ApiOkResponse({ schema: zodArraySchema(archivedTenantSchema) })
  list(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
  ): Promise<ArchivedTenant[]> {
    return this.service.list(landlord.id);
  }

  // Archive a tenant + free their property slot (ends the lease). 201.
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ schema: zodSchema(archivePropertySchema) })
  @ApiCreatedResponse({ schema: zodSchema(archiveResultSchema) })
  archive(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Body(new ZodValidationPipe(archivePropertySchema)) input: ArchivePropertyInput,
  ): Promise<ArchiveResult> {
    return this.service.archive(landlord.id, input);
  }
}
