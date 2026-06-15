import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { TenantLoginDto } from "@unitko/shared";
import { createTenantSessionToken } from "../auth/tenant-session";
import { TenantAuthRepository } from "./tenant-auth.repository";

// Business rules for the tenant auth flow. Owns credential normalization and
// session issuance; knows nothing about cookies or HTTP (that's the controller).
@Injectable()
export class TenantAuthService {
  constructor(private readonly repo: TenantAuthRepository) {}

  async login(dto: TenantLoginDto): Promise<{ tenantId: string; token: string }> {
    const email = dto.email.trim().toLowerCase();
    const contactNumber = dto.contactNumber.trim();

    const tenantId = await this.repo.findActiveTenantIdByCredentials(
      email,
      contactNumber,
    );
    if (!tenantId) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return { tenantId, token: createTenantSessionToken(tenantId) };
  }

  // Re-checks that a tenant with a cryptographically valid session is still
  // active (could have been deactivated since the cookie was issued).
  async assertStillActive(tenantId: string): Promise<void> {
    const active = await this.repo.isTenantActive(tenantId);
    if (!active) {
      throw new UnauthorizedException("Tenant is no longer active");
    }
  }
}
