import { describe, expect, it, vi } from "vitest";
import type { UpdateSubscriptionInput } from "@unitko/shared";
import { ActivityService } from "../activity/activity.service";
import { SubscriptionsRepository } from "./subscriptions.repository";
import { SubscriptionsService } from "./subscriptions.service";

const stub = <T extends object>(impl: Partial<T>): T => impl as T;

const activityStub = (log = vi.fn().mockResolvedValue(undefined)) => ({
  service: stub<ActivityService>({ log }),
  log,
});

describe("SubscriptionsService.updatePlan", () => {
  it("upserts the plan, logs the change, and returns the refreshed subscription", async () => {
    const upsertPlan = vi
      .fn<SubscriptionsRepository["upsertPlan"]>()
      .mockResolvedValue(undefined);
    const repo = stub<SubscriptionsRepository>({
      upsertPlan,
      // getForLandlord reads back through these.
      findByLandlord: vi
        .fn<SubscriptionsRepository["findByLandlord"]>()
        .mockResolvedValue({
          plan_code: "premium",
          status_code: "active",
          started_at: "2026-07-01T00:00:00.000Z",
          ends_at: null,
          last_payment_at: null,
          next_billing_at: null,
        }),
      findPlanByCode: vi
        .fn<SubscriptionsRepository["findPlanByCode"]>()
        .mockResolvedValue({
          code: "premium",
          name: "Premium",
          property_limit: 25,
          price: 499,
        }),
      countProperties: vi
        .fn<SubscriptionsRepository["countProperties"]>()
        .mockResolvedValue(3),
    });
    const { service: activity, log } = activityStub();
    const service = new SubscriptionsService(repo, activity);

    const input: UpdateSubscriptionInput = { plan: "premium" };
    const result = await service.updatePlan("landlord1", input);

    expect(upsertPlan).toHaveBeenCalledWith(
      "landlord1",
      "premium",
      expect.any(String),
    );
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "subscription_updated",
        userId: "landlord1",
        metadata: { plan: "premium" },
      }),
    );
    expect(result.plan).toBe("premium");
  });
});
