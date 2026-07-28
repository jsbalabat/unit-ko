import { Injectable } from "@nestjs/common";
import {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUSES,
  type Subscription,
  type SubscriptionPlan,
  type SubscriptionPlanInfo,
  type SubscriptionStatus,
  type UpdateSubscriptionInput,
} from "@unitko/shared";
import { ActivityService } from "../activity/activity.service";
import { SubscriptionsRepository } from "./subscriptions.repository";

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly repo: SubscriptionsRepository,
    private readonly activity: ActivityService,
  ) {}

  async listPlans(): Promise<SubscriptionPlanInfo[]> {
    const rows = await this.repo.findPlans();
    return rows.map((p) => ({
      code: toPlanCode(p.code),
      name: p.name,
      propertyLimit: p.property_limit,
      price: p.price,
    }));
  }

  // Defaults to the free plan when the landlord has no subscription row yet.
  async getForLandlord(landlordId: string): Promise<Subscription> {
    const sub = await this.repo.findByLandlord(landlordId);
    const planCode = sub?.plan_code ?? "free";
    const plan = await this.repo.findPlanByCode(planCode);
    const propertiesUsed = await this.repo.countProperties(landlordId);

    return {
      plan: toPlanCode(planCode),
      planName: plan?.name ?? planCode,
      status: toStatus(sub?.status_code ?? "active"),
      propertyLimit: plan?.property_limit ?? 0,
      propertiesUsed,
      price: plan?.price ?? 0,
      startedAt: sub?.started_at ?? null,
      endsAt: sub?.ends_at ?? null,
      lastPaymentAt: sub?.last_payment_at ?? null,
      nextBillingAt: sub?.next_billing_at ?? null,
    };
  }

  async updatePlan(
    landlordId: string,
    input: UpdateSubscriptionInput,
  ): Promise<Subscription> {
    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);
    await this.repo.upsertPlan(landlordId, input.plan, nextBilling.toISOString());
    await this.activity.log({
      actionType: "subscription_updated",
      description: `Subscription plan changed to ${input.plan}`,
      userId: landlordId,
      metadata: { plan: input.plan },
    });
    return this.getForLandlord(landlordId);
  }
}

function toPlanCode(code: string): SubscriptionPlan {
  for (const p of SUBSCRIPTION_PLANS) {
    if (p === code) return p;
  }
  return "free";
}

function toStatus(code: string): SubscriptionStatus {
  for (const s of SUBSCRIPTION_STATUSES) {
    if (s === code) return s;
  }
  return "active";
}
