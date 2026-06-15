import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async findPlans() {
    const { data, error } = await this.supabase.db
      .from("subscription_plans")
      .select("code, name, property_limit, price")
      .order("price", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async findPlanByCode(code: string) {
    const { data, error } = await this.supabase.db
      .from("subscription_plans")
      .select("code, name, property_limit, price")
      .eq("code", code)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async findByLandlord(landlordId: string) {
    const { data, error } = await this.supabase.db
      .from("subscriptions")
      .select(
        "plan_code, status_code, started_at, ends_at, last_payment_at, next_billing_at",
      )
      .eq("landlord_id", landlordId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async countProperties(landlordId: string): Promise<number> {
    const { count, error } = await this.supabase.db
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("landlord_id", landlordId);
    if (error) throw error;
    return count ?? 0;
  }

  async upsertPlan(
    landlordId: string,
    planCode: string,
    nextBillingAt: string,
  ): Promise<void> {
    const { error } = await this.supabase.db.from("subscriptions").upsert(
      {
        landlord_id: landlordId,
        plan_code: planCode,
        status_code: "active",
        next_billing_at: nextBillingAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "landlord_id" },
    );
    if (error) throw error;
  }
}
