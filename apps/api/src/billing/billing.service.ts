import { Injectable, NotFoundException } from "@nestjs/common";
import {
  BILLING_STATUSES,
  type BillingEntry,
  type BillingStatus,
  type UpdateBillingEntryInput,
} from "@unitko/shared";
import { ActivityService } from "../activity/activity.service";
import { BillingRepository, type EnrichedEntry } from "./billing.repository";

@Injectable()
export class BillingService {
  constructor(
    private readonly repo: BillingRepository,
    private readonly activity: ActivityService,
  ) {}

  async listForProperty(
    landlordId: string,
    propertyId: string,
  ): Promise<BillingEntry[]> {
    const owned = await this.repo.assertPropertyOwned(landlordId, propertyId);
    if (!owned) {
      throw new NotFoundException("Property not found");
    }
    const rows = await this.repo.findEntriesByProperty(propertyId);
    return rows.flatMap((r) => this.toEntry(r));
  }

  // Invoices for one lease (no ownership check — callers establish access first,
  // e.g. the tenant dashboard reaches it via the tenant's own active lease).
  async listForLease(leaseId: string): Promise<BillingEntry[]> {
    const rows = await this.repo.findEntriesByLease(leaseId);
    return rows.flatMap((r) => this.toEntry(r));
  }

  // Edit one invoice's rent/charges/due date; the function recomputes status and
  // verifies ownership. Returns the refreshed (derived) invoice.
  async updateEntry(
    landlordId: string,
    entryId: string,
    input: UpdateBillingEntryInput,
  ): Promise<BillingEntry> {
    await this.repo.updateEntryViaAtomicRpc(landlordId, entryId, input);
    const entry = await this.getEntryDetail(entryId);
    if (!entry) {
      throw new NotFoundException("Billing entry not found after update");
    }
    await this.activity.log({
      actionType: "billing_updated",
      description: "Invoice updated",
      userId: landlordId,
      leaseId: entry.leaseId,
      metadata: { billingEntryId: entryId },
    });
    return entry;
  }

  // Used by PaymentsService to return the refreshed invoice. No ownership check
  // here — callers reach it only after ownership is already established.
  async getEntryDetail(entryId: string): Promise<BillingEntry | null> {
    const row = await this.repo.findEntryDetailById(entryId);
    if (!row) return null;
    return this.toEntry(row)[0] ?? null;
  }

  // Returns a 0-or-1 array so a null-id view row is simply dropped (no `!`).
  private toEntry(r: EnrichedEntry): BillingEntry[] {
    const e = r.entry;
    if (e.id === null) return [];
    return [
      {
        id: e.id,
        leaseId: e.lease_id,
        periodId: e.period_id,
        tenantId: r.tenantId,
        tenantName: r.tenantName,
        dueDate: e.due_date,
        rentDue: e.rent_due ?? 0,
        otherCharges: e.other_charges ?? 0,
        grossDue: e.gross_due ?? 0,
        paidAmount: e.paid_amount ?? 0,
        balance: e.balance ?? 0,
        status: toBillingStatus(e.status_code),
        sequence: e.sequence,
        charges: r.charges,
      },
    ];
  }
}

// Narrow the stored status_code (free string at the type level) to the union.
function toBillingStatus(code: string | null): BillingStatus {
  for (const s of BILLING_STATUSES) {
    if (s === code) return s;
  }
  return "Not Yet Set";
}
