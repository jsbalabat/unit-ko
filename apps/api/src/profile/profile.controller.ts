import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import {
  updateProfileSchema,
  type Profile,
  type UpdateProfileInput,
} from "@unitko/shared";
import { SupabaseJwtGuard } from "../auth/supabase-jwt.guard";
import { CurrentLandlord } from "../auth/current-landlord.decorator";
import type { AuthenticatedLandlord } from "../auth/current-landlord.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ProfileService } from "./profile.service";

// The signed-in landlord's own profile. Identity comes from the verified JWT.
@Controller("profile")
@UseGuards(SupabaseJwtGuard)
export class ProfileController {
  constructor(private readonly service: ProfileService) {}

  @Get()
  current(@CurrentLandlord() landlord: AuthenticatedLandlord): Promise<Profile> {
    return this.service.getProfile(landlord.id);
  }

  @Put()
  update(
    @CurrentLandlord() landlord: AuthenticatedLandlord,
    @Body(new ZodValidationPipe(updateProfileSchema)) input: UpdateProfileInput,
  ): Promise<Profile> {
    return this.service.updateProfile(landlord.id, input);
  }
}
