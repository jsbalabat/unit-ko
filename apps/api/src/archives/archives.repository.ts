import { Injectable } from "@nestjs/common";
import type { ArchivePropertyInput } from "@unitko/shared";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class ArchivesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async archiveViaAtomicRpc(
    landlordId: string,
    input: ArchivePropertyInput,
  ): Promise<{ leaseId: string | null }> {
    const { data, error } = await this.supabase.db.rpc(
      "archive_and_reset_property_atomic",
      { p_landlord_id: landlordId, p_payload: input },
    );
    if (error) throw error;

    if (data && typeof data === "object" && !Array.isArray(data)) {
      return {
        leaseId: typeof data.leaseId === "string" ? data.leaseId : null,
      };
    }
    throw new Error(
      "archive_and_reset_property_atomic returned an unexpected result",
    );
  }

  async findByLandlord(landlordId: string) {
    const { data, error } = await this.supabase.db
      .from("v_archived_tenants")
      .select("*")
      .eq("landlord_id", landlordId)
      .order("archived_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }
}
