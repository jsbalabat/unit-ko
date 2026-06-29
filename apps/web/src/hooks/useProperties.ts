import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";
import type { BillingEntry as ApiBillingEntry } from "@unitko/shared";

// Dashboard-facing shape. The API splits properties, tenants, and invoices
// across endpoints; this hook recomposes them into the nested structure the
// dashboard already renders, so the UI contract is unchanged while the data
// source moves behind the API. (Migrating the UI to the raw DTOs is a separate,
// later step.)
interface PropertyWithTenant {
  id: string;
  unit_name: string;
  property_type: string;
  occupancy_status: "occupied" | "vacant";
  property_location: string;
  rent_amount: number;
  max_tenants?: number;
  created_at: string;
  tenants: Array<{
    id: string;
    tenant_name: string;
    email?: string;
    contact_number: string;
    is_active: boolean;
    billing_entries?: Array<{
      id: string;
      property_id: string;
      tenant_id: string | null;
      period_id?: string;
      due_date: string;
      status: string;
      billing_period: number;
      paid_amount?: number;
      gross_due: number;
    }>;
  }>;
}

interface PropertyStats {
  totalProperties: number;
  activeRentals: number;
  vacantProperties: number;
  totalRevenue: number;
}

// The billing endpoint exposes `tenantName` (not a tenant id) as its only link
// back to an occupant, so invoices are matched by name. When a property has a
// single active tenant, unmatched invoices fall through to that tenant — which
// is the common unified-billing case.
function attachBillingToTenants(
  propertyId: string,
  tenants: PropertyWithTenant["tenants"],
  invoices: ApiBillingEntry[],
): PropertyWithTenant["tenants"] {
  const byName = new Map<string, PropertyWithTenant["tenants"][number]>();
  for (const tenant of tenants) byName.set(tenant.tenant_name, tenant);
  const soleActive =
    tenants.filter((t) => t.is_active).length === 1
      ? tenants.find((t) => t.is_active) ?? null
      : null;

  for (const invoice of invoices) {
    const owner =
      (invoice.tenantName ? byName.get(invoice.tenantName) : null) ?? soleActive;
    if (!owner) continue;
    (owner.billing_entries ??= []).push({
      id: invoice.id,
      property_id: propertyId,
      tenant_id: owner.id,
      period_id: invoice.periodId ?? undefined,
      due_date: invoice.dueDate ?? "",
      status: invoice.status,
      billing_period: invoice.sequence ?? 0,
      paid_amount: invoice.paidAmount,
      gross_due: invoice.grossDue,
    });
  }
  return tenants;
}

export function useProperties() {
  const [properties, setProperties] = useState<PropertyWithTenant[]>([]);
  const [stats, setStats] = useState<PropertyStats>({
    totalProperties: 0,
    activeRentals: 0,
    vacantProperties: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pure fetch: assembles the dashboard view and RETURNS it without touching
  // state, so it's safe to call from an effect — the result is applied in the
  // `.then` below (deferred), never synchronously inside the effect body.
  const loadProperties = useCallback(async () => {
    const summaries = await api.properties.list();

    // Each card needs occupant identities + their invoices, which live behind
    // the per-property detail and billing endpoints. Fan out in parallel.
    const hydrated = await Promise.all(
      summaries.map(async (summary) => {
        const [detail, invoices] = await Promise.all([
          api.properties.detail(summary.id),
          api.billing.list(summary.id),
        ]);

        const tenants: PropertyWithTenant["tenants"] = detail.tenants.map(
          (t) => ({
            id: t.id,
            tenant_name: t.tenantName,
            email: t.email ?? undefined,
            contact_number: t.contactNumber,
            is_active: t.isActive,
            billing_entries: [],
          }),
        );

        return {
          id: summary.id,
          unit_name: summary.unitName,
          property_type: summary.propertyType ?? "",
          occupancy_status: summary.occupancyStatus,
          property_location: summary.propertyLocation ?? "",
          rent_amount: summary.rentAmount,
          max_tenants: summary.maxTenants,
          created_at: summary.createdAt,
          tenants: attachBillingToTenants(summary.id, tenants, invoices),
        } satisfies PropertyWithTenant;
      }),
    );

    const stats: PropertyStats = {
      totalProperties: hydrated.length,
      activeRentals: hydrated.filter((p) => p.occupancy_status === "occupied")
        .length,
      vacantProperties: hydrated.filter((p) => p.occupancy_status === "vacant")
        .length,
      totalRevenue: hydrated
        .filter((p) => p.occupancy_status === "occupied")
        .reduce((sum, p) => sum + p.rent_amount, 0),
    };

    return { hydrated, stats };
  }, []);

  const applyProperties = useCallback(
    (data: { hydrated: PropertyWithTenant[]; stats: PropertyStats }) => {
      setProperties(data.hydrated);
      setStats(data.stats);
      setError(null);
    },
    [],
  );

  useEffect(() => {
    let ignore = false;
    loadProperties()
      .then((data) => {
        if (!ignore) applyProperties(data);
      })
      .catch((err) => {
        if (!ignore)
          setError(
            err instanceof Error ? err.message : "Failed to fetch properties",
          );
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [loadProperties, applyProperties]);

  // Refresh the dashboard data. A "silent" refresh (used when an open popup
  // triggers it) updates in place WITHOUT re-entering the full-screen loading
  // state — otherwise the `if (loading)` skeleton unmounts the dashboard and the
  // popup stack above it. A loud refresh (default) shows the skeleton.
  const refetch = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      return loadProperties()
        .then(applyProperties)
        .catch((err) =>
          setError(
            err instanceof Error ? err.message : "Failed to fetch properties",
          ),
        )
        .finally(() => {
          if (!silent) setLoading(false);
        });
    },
    [loadProperties, applyProperties],
  );

  return {
    properties,
    stats,
    loading,
    error,
    refetch,
  };
}
