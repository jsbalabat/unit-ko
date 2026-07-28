import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { UpdateProfileInput } from "@unitko/shared";
import { ActivityService } from "../activity/activity.service";
import { ProfileRepository } from "./profile.repository";
import { ProfileService } from "./profile.service";

const stub = <T extends object>(impl: Partial<T>): T => impl as T;

const activityStub = (log = vi.fn().mockResolvedValue(undefined)) => ({
  service: stub<ActivityService>({ log }),
  log,
});

// `findProfile` returns the Supabase-generated select shape; build the row
// loosely (bare `vi.fn()`) so the test isn't coupled to regenerated DB types.
const row = (over: Record<string, unknown> = {}) => ({
  id: "landlord1",
  email: "landlord@example.com",
  full_name: "Land Lord",
  username: "landlord",
  phone: "0917",
  role: "landlord",
  created_at: "2026-01-01T00:00:00.000Z",
  landlord_payout_methods: [],
  ...over,
});

describe("ProfileService.getProfile", () => {
  it("rejects with NotFound when the landlord has no profile row", async () => {
    const repo = stub<ProfileRepository>({
      findProfile: vi.fn().mockResolvedValue(null),
    });
    const service = new ProfileService(repo, activityStub().service);

    await expect(service.getProfile("landlord1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("maps the row to the profile DTO", async () => {
    const repo = stub<ProfileRepository>({
      findProfile: vi.fn().mockResolvedValue(row()),
    });
    const service = new ProfileService(repo, activityStub().service);

    const profile = await service.getProfile("landlord1");

    expect(profile).toMatchObject({
      id: "landlord1",
      email: "landlord@example.com",
      fullName: "Land Lord",
      role: "landlord",
      payoutMethods: [],
    });
  });
});

describe("ProfileService.updateProfile", () => {
  it("writes identity only, leaving payout channels untouched, when no payoutMethods are given", async () => {
    const updateIdentity = vi
      .fn<ProfileRepository["updateIdentity"]>()
      .mockResolvedValue(undefined);
    const replacePayoutMethods = vi
      .fn<ProfileRepository["replacePayoutMethods"]>()
      .mockResolvedValue(undefined);
    const repo = stub<ProfileRepository>({
      updateIdentity,
      replacePayoutMethods,
      findProfile: vi.fn().mockResolvedValue(row({ full_name: "New Name" })),
    });
    const { service: activity, log } = activityStub();
    const service = new ProfileService(repo, activity);

    await service.updateProfile("landlord1", { fullName: "New Name" });

    expect(updateIdentity).toHaveBeenCalledWith("landlord1", {
      full_name: "New Name",
    });
    expect(replacePayoutMethods).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "profile_updated",
        description: "Profile details updated",
        metadata: { changed: ["identity"] },
      }),
    );
  });

  it("replaces the full payout set even when given an empty array, without touching identity", async () => {
    const updateIdentity = vi
      .fn<ProfileRepository["updateIdentity"]>()
      .mockResolvedValue(undefined);
    const replacePayoutMethods = vi
      .fn<ProfileRepository["replacePayoutMethods"]>()
      .mockResolvedValue(undefined);
    const repo = stub<ProfileRepository>({
      updateIdentity,
      replacePayoutMethods,
      findProfile: vi.fn().mockResolvedValue(row()),
    });
    const { service: activity, log } = activityStub();
    const service = new ProfileService(repo, activity);

    const input: UpdateProfileInput = { payoutMethods: [] };
    await service.updateProfile("landlord1", input);

    expect(replacePayoutMethods).toHaveBeenCalledWith("landlord1", []);
    expect(updateIdentity).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "profile_updated",
        description: "Payout methods updated",
        metadata: { changed: ["payoutMethods"] },
      }),
    );
  });
});
