import { api, ApiError } from "@/lib/api-client";

// Re-exported so consumers keep importing the archive shape from this service
// while the definition lives in the shared FE/BE contract.
export type { ArchivedTenant } from "@unitko/shared";

interface ResetPropertyData {
  propertyId: string;
  tenantId: string;
  remarks: string;
}

// Ends the tenant's lease and frees their property slot (non-destructive: the
// lease + its billing history are retained, the slot is reset). The API logs
// the activity server-side, so no client-side activity write is needed here.
export async function archiveAndResetProperty(data: ResetPropertyData): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await api.archives.archive(data);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "An unknown error occurred",
    };
  }
}

export async function fetchArchivedTenants() {
  try {
    const data = await api.archives.list();
    return { data, error: null as string | null };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch archived tenants",
    };
  }
}
