import { Injectable, NotFoundException } from "@nestjs/common";
import {
  ROLES,
  type Profile,
  type Role,
  type UpdateProfileInput,
} from "@unitko/shared";
import { ActivityService } from "../activity/activity.service";
import { toPayoutChannel } from "../common/payout";
import { ProfileRepository } from "./profile.repository";

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  role: string;
  created_at: string;
  landlord_payout_methods: {
    method: string;
    account_name: string | null;
    account_number: string | null;
    details: string | null;
  }[];
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly repo: ProfileRepository,
    private readonly activity: ActivityService,
  ) {}

  async getProfile(landlordId: string): Promise<Profile> {
    const row = await this.repo.findProfile(landlordId);
    if (!row) throw new NotFoundException("Profile not found");
    return this.toProfile(row);
  }

  async updateProfile(
    landlordId: string,
    input: UpdateProfileInput,
  ): Promise<Profile> {
    const identity: { full_name?: string | null; phone?: string | null } = {};
    if (input.fullName !== undefined) identity.full_name = input.fullName;
    if (input.phone !== undefined) identity.phone = input.phone;
    const identityChanged = Object.keys(identity).length > 0;
    if (identityChanged) {
      await this.repo.updateIdentity(landlordId, identity);
    }

    // A present (even empty) payoutMethods array replaces the full set.
    let payoutChanged = false;
    if (input.payoutMethods !== undefined) {
      await this.repo.replacePayoutMethods(landlordId, input.payoutMethods);
      payoutChanged = true;
    }

    if (identityChanged || payoutChanged) {
      const changed = [
        ...(identityChanged ? ["identity"] : []),
        ...(payoutChanged ? ["payoutMethods"] : []),
      ];
      await this.activity.log({
        actionType: "profile_updated",
        // Call out payout changes explicitly — a change of financial destination
        // is the most security-relevant edit this endpoint accepts.
        description: payoutChanged
          ? "Payout methods updated"
          : "Profile details updated",
        userId: landlordId,
        metadata: { changed },
      });
    }

    return this.getProfile(landlordId);
  }

  private toProfile(row: ProfileRow): Profile {
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      username: row.username,
      phone: row.phone,
      role: toRole(row.role),
      createdAt: row.created_at,
      payoutMethods: row.landlord_payout_methods
        .map(toPayoutChannel)
        .filter((m): m is NonNullable<typeof m> => m !== null),
    };
  }
}

function toRole(value: string): Role {
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : "landlord";
}
