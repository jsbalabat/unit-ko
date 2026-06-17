import { api } from "@/lib/api-client";
import type { Subscription, SubscriptionPlan } from "@unitko/shared";

// The landlord's current subscription + derived usage. Plan limits and prices
// now live in the DB (subscription_plans lookup), surfaced through the API —
// they used to be hardcoded here.
export async function fetchUserSubscription(): Promise<Subscription> {
  return api.subscription.current();
}

// Switch plan. No payment processing is in scope; the API just updates the row.
export async function updateSubscriptionPlan(
  plan: SubscriptionPlan,
): Promise<Subscription> {
  return api.subscription.update({ plan });
}
