import { Injectable, NotFoundException } from "@nestjs/common";
import {
  BILLING_FREQUENCIES,
  type BillingFrequency,
  type PayoutChannel,
  type TenantDashboard,
} from "@unitko/shared";
import { BillingService } from "../billing/billing.service";
import { toPayoutChannel } from "../common/payout";
import { TenantDashboardRepository } from "./tenant-dashboard.repository";

@Injectable()
export class TenantDashboardService {
  constructor(
    private readonly repo: TenantDashboardRepository,
    private readonly billing: BillingService,
  ) {}

  async getDashboard(tenantId: string): Promise<TenantDashboard> {
    const tenant = await this.repo.findActiveTenant(tenantId);
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }

    const lease = await this.repo.findActiveLeaseWithProperty(tenantId);
    const property = lease?.properties ?? null;
    // Billing is reused from BillingService so the derived-figure mapping isn't
    // duplicated; scoped to the tenant's own active lease.
    const billingEntries = lease ? await this.billing.listForLease(lease.id) : [];

    const payout = property
      ? await this.repo.findLandlordPayout(property.landlord_id)
      : null;
    const payoutMethods: PayoutChannel[] = (payout?.landlord_payout_methods ?? [])
      .map(toPayoutChannel)
      .filter((m): m is PayoutChannel => m !== null);

    return {
      tenant: {
        id: tenant.id,
        tenantName: tenant.tenant_name,
        email: tenant.email,
        contactNumber: tenant.contact_number,
      },
      lease: lease
        ? {
            id: lease.id,
            contractPeriods: lease.contract_periods,
            rentStartDate: lease.rent_start_date,
            rentEndDate: lease.rent_end_date,
            dueDay: lease.due_day,
            rentAmount: lease.rent_amount,
            billingFrequency: toBillingFrequency(lease.billing_frequency_code),
          }
        : null,
      property: property
        ? {
            id: property.id,
            unitName: property.unit_name,
            propertyType: property.property_type_code,
            propertyLocation: property.property_location,
            rentAmount: property.rent_amount,
          }
        : null,
      billingEntries,
      landlordName: payout?.full_name ?? null,
      payoutMethods,
    };
  }
}

function toBillingFrequency(code: string): BillingFrequency {
  for (const f of BILLING_FREQUENCIES) {
    if (f === code) return f;
  }
  return "monthly";
}
