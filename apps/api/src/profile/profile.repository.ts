import { Injectable } from "@nestjs/common";
import type { PayoutChannel } from "@unitko/shared";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class ProfileRepository {
  constructor(private readonly supabase: SupabaseService) {}

  // Identity + payout channels in one read (reverse-embeds the methods).
  async findProfile(landlordId: string) {
    const { data, error } = await this.supabase.db
      .from("profiles")
      .select(
        "id, email, full_name, username, phone, role, created_at, landlord_payout_methods(method, account_name, account_number, details)",
      )
      .eq("id", landlordId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updateIdentity(
    landlordId: string,
    fields: { full_name?: string | null; phone?: string | null },
  ): Promise<void> {
    const { error } = await this.supabase.db
      .from("profiles")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", landlordId);
    if (error) throw error;
  }

  // Atomic full-set replace (delete + insert in one transaction) — see the
  // replace_landlord_payout_methods migration.
  async replacePayoutMethods(
    landlordId: string,
    methods: PayoutChannel[],
  ): Promise<void> {
    const { error } = await this.supabase.db.rpc(
      "replace_landlord_payout_methods",
      { p_landlord_id: landlordId, p_payload: methods },
    );
    if (error) throw error;
  }
}
