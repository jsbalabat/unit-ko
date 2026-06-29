import { supabase } from "@/lib/supabase";
import type {
  ActivityLog,
  ArchivedTenant,
  ArchivePropertyInput,
  ArchiveResult,
  BillingEntry,
  BillingRevision,
  CreatePropertyInput,
  CreateTenantInput,
  Profile,
  PropertyDetail,
  PropertyNote,
  PropertySummary,
  RecordPaymentInput,
  RecordPaymentResult,
  RecordReminderInput,
  ReminderResult,
  Subscription,
  UpdateBillingEntryInput,
  SubscriptionPlanInfo,
  TenantDashboard,
  TenantListItem,
  TenantLoginDto,
  TenantLoginResponse,
  TenantSessionResponse,
  UpdatePropertyInput,
  UpdateProfileInput,
  UpdateSubscriptionInput,
  UpdateTenantInput,
  WritePropertyNoteInput,
} from "@unitko/shared";

// The single HTTP boundary between the browser and the NestJS API. Every data
// read/write goes through here; the browser never touches Postgres directly.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// How a request authenticates. Landlord routes carry the Supabase access token
// as a Bearer header; tenant routes rely on the httpOnly HMAC session cookie
// (hence credentials:include); public routes send neither.
type AuthMode = "landlord" | "tenant" | "none";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Parsed and JSON-encoded; omit for GET/DELETE. */
  body?: unknown;
  /** Query params; null/undefined values are dropped. */
  query?: Record<string, string | number | boolean | null | undefined>;
  auth?: AuthMode;
}

// Thrown for any non-2xx response. `status` lets callers branch on 401/422/429
// without string-matching, while `message` carries the API's error text.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Landlord identity flows from the verified Supabase JWT, never a client-held
// id. A missing session means the caller isn't authenticated as a landlord.
async function landlordAuthHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new ApiError(401, "Not authenticated");
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

// The NestJS exception filter returns `{ message }` (string or string[]); fall
// back to the raw text/status when the body isn't the expected shape.
async function parseError(response: Response): Promise<ApiError> {
  let body: unknown;
  let message = `Request failed with status ${response.status}`;
  try {
    body = await response.json();
    const m = (body as { message?: unknown }).message;
    if (typeof m === "string") message = m;
    else if (Array.isArray(m) && m.length > 0) message = m.join(", ");
  } catch {
    // Non-JSON error body — keep the status-based default message.
  }
  return new ApiError(response.status, message, body);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, auth = "landlord" } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth === "landlord") Object.assign(headers, await landlordAuthHeader());

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    // Tenant routes authenticate via the session cookie set by the API.
    credentials: auth === "tenant" ? "include" : "same-origin",
  });

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// Endpoint methods grouped by domain. Names mirror the controller routes so the
// FE/BE contract stays legible from either side.
export const api = {
  properties: {
    list: () => request<PropertySummary[]>("/properties"),
    detail: (id: string) => request<PropertyDetail>(`/properties/${id}`),
    create: (input: CreatePropertyInput) =>
      request<PropertyDetail>("/properties", { method: "POST", body: input }),
    update: (id: string, input: UpdatePropertyInput) =>
      request<PropertyDetail>(`/properties/${id}`, {
        method: "PATCH",
        body: input,
      }),
    addNote: (propertyId: string, input: WritePropertyNoteInput) =>
      request<PropertyNote>(`/properties/${propertyId}/notes`, {
        method: "POST",
        body: input,
      }),
    updateNote: (propertyId: string, noteId: string, input: WritePropertyNoteInput) =>
      request<PropertyNote>(`/properties/${propertyId}/notes/${noteId}`, {
        method: "PATCH",
        body: input,
      }),
    deleteNote: (propertyId: string, noteId: string) =>
      request<void>(`/properties/${propertyId}/notes/${noteId}`, {
        method: "DELETE",
      }),
  },

  tenants: {
    list: (assigned?: boolean) =>
      request<TenantListItem[]>("/tenants", {
        query: { assigned: assigned === undefined ? undefined : assigned },
      }),
    create: (input: CreateTenantInput) =>
      request<TenantListItem>("/tenants", { method: "POST", body: input }),
    update: (id: string, input: UpdateTenantInput) =>
      request<TenantListItem>(`/tenants/${id}`, {
        method: "PATCH",
        body: input,
      }),
  },

  billing: {
    list: (propertyId: string) =>
      request<BillingEntry[]>("/billing/entries", { query: { propertyId } }),
    update: (id: string, input: UpdateBillingEntryInput) =>
      request<BillingEntry>(`/billing/entries/${id}`, {
        method: "PATCH",
        body: input,
      }),
    revisions: (id: string) =>
      request<BillingRevision[]>(`/billing/entries/${id}/revisions`),
  },

  payments: {
    record: (input: RecordPaymentInput) =>
      request<RecordPaymentResult>("/payments", { method: "POST", body: input }),
  },

  reminders: {
    record: (input: RecordReminderInput) =>
      request<ReminderResult>("/reminders", { method: "POST", body: input }),
  },

  subscription: {
    current: () => request<Subscription>("/subscription"),
    plans: () => request<SubscriptionPlanInfo[]>("/subscription/plans"),
    update: (input: UpdateSubscriptionInput) =>
      request<Subscription>("/subscription", { method: "PUT", body: input }),
  },

  activity: {
    list: (query?: { propertyId?: string; limit?: number }) =>
      request<ActivityLog[]>("/activity", { query }),
  },

  archives: {
    list: () => request<ArchivedTenant[]>("/archives"),
    archive: (input: ArchivePropertyInput) =>
      request<ArchiveResult>("/archives", { method: "POST", body: input }),
  },

  // Tenant auth + dashboard use the cookie session, not a Bearer token.
  tenantAuth: {
    login: (input: TenantLoginDto) =>
      request<TenantLoginResponse>("/tenant-auth/login", {
        method: "POST",
        body: input,
        auth: "tenant",
      }),
    session: () =>
      request<TenantSessionResponse>("/tenant-auth/session", { auth: "tenant" }),
    logout: () =>
      request<{ success: true }>("/tenant-auth/logout", {
        method: "POST",
        auth: "tenant",
      }),
  },

  tenant: {
    dashboard: () =>
      request<TenantDashboard>("/tenant/dashboard", { auth: "tenant" }),
  },

  profile: {
    get: () => request<Profile>("/profile"),
    update: (input: UpdateProfileInput) =>
      request<Profile>("/profile", { method: "PUT", body: input }),
  },
};
