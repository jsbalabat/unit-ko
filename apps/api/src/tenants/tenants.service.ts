import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AssignTenantInput,
  CreateTenantInput,
  TenantListItem,
  TransferRequest,
  TransferTenantInput,
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

  // Place an unhoused tenant onto one of the landlord's properties (property_id +
  // next slot). No lease is created — the tenant reads "No Active Lease" until one
  // is set up from the property, exactly as for a tenant added with a property.
  async assign(
    landlordId: string,
    tenantId: string,
    input: AssignTenantInput,
  ): Promise<TenantListItem> {
    const existing = await this.repo.findByIdForLandlord(landlordId, tenantId);
    if (!existing) {
      throw new NotFoundException("Tenant not found");
    }
    if (existing.property_id) {
      throw new ConflictException("Tenant is already assigned to a property");
    }

    let row: Awaited<ReturnType<TenantsRepository["assignToProperty"]>>;
    try {
      row = await this.repo.assignToProperty(landlordId, tenantId, input.propertyId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/property not found/i.test(message)) {
        throw new NotFoundException("Property not found");
      }
      throw err;
    }
    if (!row) {
      // The tenant was housed between the check and the update (a race).
      throw new ConflictException("Tenant is already assigned to a property");
    }

    await this.activity.log({
      actionType: "tenant_updated",
      description: `Tenant assigned: ${row.tenant_name}`,
      userId: landlordId,
      tenantId,
      propertyId: row.property_id,
      metadata: { assignedToPropertyId: input.propertyId },
    });

    return this.toListItem(row);
  }

  // Propose a transfer for the tenant to confirm — nothing moves until they do. The
  // RPC enforces ownership + the tenant's transferable state + one-pending-per-tenant;
  // map its raised errors to 404/409, then log the proposal.
  async proposeTransfer(
    landlordId: string,
    tenantId: string,
    input: TransferTenantInput,
  ): Promise<TransferRequest> {
    let requestId: string;
    try {
      requestId = await this.repo.createTransferRequestViaAtomicRpc(
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
      if (/already pending/i.test(message)) {
        throw new ConflictException(
          "A transfer is already pending for this tenant",
        );
      }
      if (/already on this property/i.test(message)) {
        throw new ConflictException("Tenant is already on this property");
      }
      throw err;
    }

    const request = await this.repo.findRequest(requestId);
    if (!request) {
      throw new NotFoundException("Transfer request not found after creation");
    }
    await this.activity.log({
      actionType: "tenant_transfer_proposed",
      description: `Transfer proposed to ${request.toPropertyName}`,
      userId: landlordId,
      tenantId,
      metadata: { requestId, toPropertyName: request.toPropertyName },
    });
    return request;
  }

  listPendingTransferRequests(landlordId: string): Promise<TransferRequest[]> {
    return this.repo.findPendingByLandlord(landlordId);
  }

  // Withdraw a pending proposal before the tenant responds.
  async cancelTransferRequest(
    landlordId: string,
    requestId: string,
  ): Promise<TransferRequest> {
    const cancelled = await this.repo.cancelRequest(landlordId, requestId);
    if (!cancelled) {
      throw new NotFoundException("Pending transfer request not found");
    }
    await this.activity.log({
      actionType: "tenant_transfer_cancelled",
      description: "Transfer cancelled",
      userId: landlordId,
      tenantId: cancelled.tenantId,
      metadata: { requestId },
    });
    return cancelled;
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
