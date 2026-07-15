import { Injectable, NotFoundException } from "@nestjs/common";
import {
  TENANT_RESPONSE_TYPES,
  type CreateTenantResponseInput,
  type TenantResponse,
  type TenantResponseType,
} from "@unitko/shared";
import {
  ResponsesRepository,
  type TenantResponseView,
} from "./responses.repository";

@Injectable()
export class ResponsesService {
  constructor(private readonly repo: ResponsesRepository) {}

  async createForTenant(
    tenantId: string,
    input: CreateTenantResponseInput,
  ): Promise<TenantResponse> {
    // 404 (not 403) when the bill is missing OR belongs to another tenant — the
    // response must not reveal which of the two it was.
    const ownerTenantId = await this.repo.findEntryTenant(input.billingEntryId);
    if (ownerTenantId !== tenantId) {
      throw new NotFoundException("Billing entry not found");
    }

    const id = await this.repo.create({
      billingEntryId: input.billingEntryId,
      tenantId,
      responseType: input.responseType,
      note: input.note ?? null,
    });

    const row = await this.repo.findById(id);
    if (!row) {
      throw new NotFoundException("Response not found");
    }
    return toDto(row);
  }

  async listForTenant(
    tenantId: string,
    limit?: number,
  ): Promise<TenantResponse[]> {
    const rows = await this.repo.findByTenant(tenantId, clampLimit(limit));
    return mapRows(rows);
  }

  async listForLandlord(
    landlordId: string,
    limit?: number,
  ): Promise<TenantResponse[]> {
    const rows = await this.repo.findByLandlord(landlordId, clampLimit(limit));
    return mapRows(rows);
  }

  async confirmForLandlord(
    landlordId: string,
    responseId: string,
  ): Promise<TenantResponse> {
    const existing = await this.repo.findById(responseId);
    if (!existing || existing.landlord_id !== landlordId) {
      throw new NotFoundException("Response not found");
    }

    await this.repo.confirm(responseId, landlordId, new Date().toISOString());

    const updated = await this.repo.findById(responseId);
    if (!updated) {
      throw new NotFoundException("Response not found");
    }
    return toDto(updated);
  }
}

function clampLimit(limit?: number): number {
  const requested =
    typeof limit === "number" && Number.isFinite(limit) ? limit : 10;
  return Math.min(Math.max(requested, 1), 50);
}

function mapRows(rows: TenantResponseView[]): TenantResponse[] {
  return rows
    .filter((r): r is TenantResponseView & { id: string } => r.id !== null)
    .map(toDto);
}

function toDto(r: TenantResponseView): TenantResponse {
  return {
    id: r.id ?? "",
    billingEntryId: r.billing_entry_id ?? "",
    responseType: toResponseType(r.response_type_code),
    responseTypeLabel: r.response_type_label ?? "",
    note: r.note,
    tenantName: r.tenant_name,
    propertyName: r.property_name,
    dueDate: r.due_date,
    createdAt: r.created_at ?? "",
    confirmedAt: r.confirmed_at,
  };
}

const RESPONSE_TYPE_SET = new Set<string>(TENANT_RESPONSE_TYPES);

function isResponseType(code: string): code is TenantResponseType {
  return RESPONSE_TYPE_SET.has(code);
}

// The feed view types response_type_code as a free string; the base column is
// FK-constrained to tenant_response_types, so narrow defensively rather than
// trust blindly.
function toResponseType(code: string | null): TenantResponseType {
  return code !== null && isResponseType(code) ? code : "acknowledged";
}
