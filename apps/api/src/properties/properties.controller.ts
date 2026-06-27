import {
  Body,
  Controller,
  Delete,
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
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import {
  createPropertySchema,
  propertyDetailSchema,
  propertyNoteSchema,
  propertySummarySchema,
  updatePropertySchema,
  writePropertyNoteSchema,
  type CreatePropertyInput,
  type PropertyDetail,
  type PropertyNote,
  type PropertySummary,
  type UpdatePropertyInput,
  type WritePropertyNoteInput,
} from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { zodArraySchema, zodSchema } from "../common/openapi";
import { PropertiesService } from "./properties.service";

// All property routes require a verified landlord JWT. The landlord id comes
// from the token (never the request), and every query is scoped to it.
@ApiTags("properties")
@ApiBearerAuth("landlord-jwt")
@Controller("properties")
@UseGuards(SupabaseJwtGuard)
export class PropertiesController {
  constructor(private readonly service: PropertiesService) {}

  @Get()
  @ApiOkResponse({ schema: zodArraySchema(propertySummarySchema) })
  list(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
  ): Promise<PropertySummary[]> {
    return this.service.listForLandlord(landlord.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ schema: zodSchema(createPropertySchema) })
  @ApiCreatedResponse({ schema: zodSchema(propertyDetailSchema) })
  create(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Body(new ZodValidationPipe(createPropertySchema)) input: CreatePropertyInput,
  ): Promise<PropertyDetail> {
    return this.service.create(landlord.id, input);
  }

  @Get(":id")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiOkResponse({ schema: zodSchema(propertyDetailSchema) })
  detail(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<PropertyDetail> {
    return this.service.getDetailForLandlord(landlord.id, id);
  }

  @Patch(":id")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: zodSchema(updatePropertySchema) })
  @ApiOkResponse({ schema: zodSchema(propertyDetailSchema) })
  update(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePropertySchema)) input: UpdatePropertyInput,
  ): Promise<PropertyDetail> {
    return this.service.update(landlord.id, id, input);
  }

  @Post(":id/notes")
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({ schema: zodSchema(writePropertyNoteSchema) })
  @ApiCreatedResponse({ schema: zodSchema(propertyNoteSchema) })
  addNote(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(writePropertyNoteSchema))
    input: WritePropertyNoteInput,
  ): Promise<PropertyNote> {
    return this.service.addNote(landlord.id, id, input);
  }

  @Patch(":id/notes/:noteId")
  @ApiParam({ name: "id", format: "uuid" })
  @ApiParam({ name: "noteId", format: "uuid" })
  @ApiBody({ schema: zodSchema(writePropertyNoteSchema) })
  @ApiOkResponse({ schema: zodSchema(propertyNoteSchema) })
  updateNote(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("noteId", ParseUUIDPipe) noteId: string,
    @Body(new ZodValidationPipe(writePropertyNoteSchema))
    input: WritePropertyNoteInput,
  ): Promise<PropertyNote> {
    return this.service.updateNote(landlord.id, id, noteId, input);
  }

  @Delete(":id/notes/:noteId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: "id", format: "uuid" })
  @ApiParam({ name: "noteId", format: "uuid" })
  @ApiNoContentResponse()
  deleteNote(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("noteId", ParseUUIDPipe) noteId: string,
  ): Promise<void> {
    return this.service.deleteNote(landlord.id, id, noteId);
  }
}
