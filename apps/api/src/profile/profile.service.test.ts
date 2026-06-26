import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { UpdateProfileInput } from "@unitko/shared";
import { ProfileRepository } from "./profile.repository";
import { ProfileService } from "./profile.service";

const stub = <T extends object>(impl: Partial<T>): T => impl as T;

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
    const service = new ProfileService(repo);

    await expect(service.getProfile("landlord1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("maps the row to the profile DTO", async () => {
    const repo = stub<ProfileRepository>({
      findProfile: vi.fn().mockResolvedValue(row()),
    });
    const service = new ProfileService(repo);

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
    const service = new ProfileService(repo);

    await service.updateProfile("landlord1", { fullName: "New Name" });

    expect(updateIdentity).toHaveBeenCalledWith("landlord1", {
      full_name: "New Name",
    });
    expect(replacePayoutMethods).not.toHaveBeenCalled();
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
    const service = new ProfileService(repo);

    const input: UpdateProfileInput = { payoutMethods: [] };
    await service.updateProfile("landlord1", input);

    expect(replacePayoutMethods).toHaveBeenCalledWith("landlord1", []);
    expect(updateIdentity).not.toHaveBeenCalled();
  });
});
