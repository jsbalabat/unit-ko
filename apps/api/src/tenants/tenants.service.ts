import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateTenantInput,
  TenantListItem,
  TransferTenantInput,
  TransferTenantResult,
  UpdateTenantInput,
} from "@unitko/shared";
import { ActivityService } from "../activity/activity.service";
import { TenantsRepository } from "./tenants.repository";

// Tenant row as selected by the repository (snake_case + embedded property name).
interface TenantRow {
  id: string;
  tenant_name: string;
  email: string | null;
  contact_number: string;
  property_id: string | null;
  tenant_slot: number | null;
  is_active: boolean;
  created_at: string;
  properties: { unit_name: string } | null;
}

@Injectable()
export class TenantsService {
  constructor(
    private readonly repo: TenantsRepository,
    private readonly activity: ActivityService,
  ) {}

  async create(
    landlordId: string,
    input: CreateTenantInput,
  ): Promise<TenantListItem> {
    const tenantId = await this.repo.createViaAtomicRpc(landlordId, input);
    await this.activity.log({
      actionType: "tenant_added",
      description: `Tenant added: ${input.tenantName}`,
      userId: landlordId,
      tenantId,
      propertyId: input.propertyId ?? null,
      metadata: { unhoused: !input.propertyId },
    });
    const row = await this.repo.findByIdForLandlord(landlordId, tenantId);
    if (!row) {
      throw new NotFoundException("Tenant not found after creation");
    }
    return this.toListItem(row);
  }

  async list(
    landlordId: string,
    assigned?: boolean,
  ): Promise<TenantListItem[]> {
    const rows = await this.repo.findAllByLandlord(landlordId, assigned);
    return rows.map((r) => this.toListItem(r)).sort(byUnassignedThenName);
  }

  async update(
    landlordId: string,
    tenantId: string,
    input: UpdateTenantInput,
  ): Promise<TenantListItem> {
    const existing = await this.repo.findByIdForLandlord(landlordId, tenantId);
    if (!existing) {
      throw new NotFoundException("Tenant not found");
    }
    await this.repo.updateIdentity(landlordId, tenantId, input);
    const row = await this.repo.findByIdForLandlord(landlordId, tenantId);
    if (!row) {
      throw new NotFoundException("Tenant not found");
    }
    await this.activity.log({
      actionType: "tenant_updated",
      description: `Tenant updated: ${row.tenant_name}`,
      userId: landlordId,
      tenantId,
      propertyId: row.property_id,
      metadata: { fields: Object.keys(input) },
    });
    return this.toListItem(row);
  }

  // Transfer a tenant to another of the landlord's properties. The RPC enforces
  // ownership and the tenant's transferable state; map its raised errors to the
  // right HTTP status so the client sees a 404/409, not an opaque 500. The log is
  // attributed to the destination (where the active lease now lives), with the
  // source carried in metadata.
  async transfer(
    landlordId: string,
    tenantId: string,
    input: TransferTenantInput,
  ): Promise<TransferTenantResult> {
    let result: TransferTenantResult;
    try {
      result = await this.repo.transferViaAtomicRpc(
        landlordId,
        tenantId,
        input.toPropertyId,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/tenant not found/i.test(message)) {
        throw new NotFoundException("Tenant not found");
      }
      if (/destination property not found|not owned by landlord/i.test(message)) {
        throw new NotFoundException("Destination property not found");
      }
      if (/no active lease/i.test(message)) {
        throw new ConflictException("Tenant has no active lease to transfer");
      }
      if (/already on this property/i.test(message)) {
        throw new ConflictException("Tenant is already on this property");
      }
      throw err;
    }

    await this.activity.log({
      actionType: "tenant_transferred",
      description: "Tenant transferred",
      userId: landlordId,
      propertyId: result.toPropertyId,
      tenantId: result.tenantId,
      leaseId: result.toLeaseId,
      metadata: {
        fromPropertyId: result.fromPropertyId,
        toPropertyId: result.toPropertyId,
        fromLeaseId: result.fromLeaseId,
        toLeaseId: result.toLeaseId,
        transferredCount: result.transferredCount,
      },
    });

    return result;
  }

  private toListItem(row: TenantRow): TenantListItem {
    return {
      id: row.id,
      tenantName: row.tenant_name,
      email: row.email,
      contactNumber: row.contact_number,
      propertyId: row.property_id,
      propertyName: row.properties?.unit_name ?? null,
      tenantSlot: row.tenant_slot,
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  }
}

// Unassigned (no property) first, then by property name, then by tenant name.
function byUnassignedThenName(a: TenantListItem, b: TenantListItem): number {
  if (a.propertyName === null && b.propertyName !== null) return -1;
  if (a.propertyName !== null && b.propertyName === null) return 1;
  if (a.propertyName && b.propertyName) {
    const byProperty = a.propertyName.localeCompare(b.propertyName);
    if (byProperty !== 0) return byProperty;
  }
  return a.tenantName.localeCompare(b.tenantName);
}
