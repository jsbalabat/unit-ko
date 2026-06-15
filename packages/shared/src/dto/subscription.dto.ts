import { z } from "zod";
import { SUBSCRIPTION_PLANS, SUBSCRIPTION_STATUSES } from "../enums";

// A plan from the subscription_plans lookup. property_limit/price live in the DB
// now (was hardcoded PLAN_LIMITS/planPrices in the web app). Named *Info to avoid
// colliding with the SubscriptionPlan code union exported from enums.
export const subscriptionPlanInfoSchema = z.object({
  code: z.enum(SUBSCRIPTION_PLANS),
  name: z.string(),
  propertyLimit: z.number().int(),
  price: z.number(),
});
export type SubscriptionPlanInfo = z.infer<typeof subscriptionPlanInfoSchema>;

// The landlord's current subscription + derived usage. Defaults to the free plan
// when no subscription row exists yet.
export const subscriptionSchema = z.object({
  plan: z.enum(SUBSCRIPTION_PLANS),
  planName: z.string(),
  status: z.enum(SUBSCRIPTION_STATUSES),
  propertyLimit: z.number().int(),
  propertiesUsed: z.number().int(),
  price: z.number(),
  startedAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  lastPaymentAt: z.string().nullable(),
  nextBillingAt: z.string().nullable(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

// PUT /subscription — switch plan (no payment processing in scope).
export const updateSubscriptionSchema = z.object({
  plan: z.enum(SUBSCRIPTION_PLANS),
});
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
