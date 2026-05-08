"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  UserX,
  Users,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  listLandlordTenants,
  type TenantListRow,
} from "@/services/tenantService";

export type TenantsListFilter = "all" | "unassigned";

interface TenantsListPopupProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-selects the filter when the popup opens. Defaults to "all". */
  initialFilter?: TenantsListFilter;
}

export function TenantsListPopup({
  isOpen,
  onClose,
  initialFilter = "all",
}: TenantsListPopupProps) {
  const [tenants, setTenants] = useState<TenantListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TenantsListFilter>(initialFilter);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listLandlordTenants();
      setTenants(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Reset filter to the caller's chosen initial state every time the
      // popup opens so each entry point lands on the right view.
      setFilter(initialFilter);
      void load();
    }
  }, [isOpen, initialFilter]);

  const unassignedCount = tenants.filter((t) => !t.property_id).length;
  const assignedCount = tenants.length - unassignedCount;

  const visibleTenants = useMemo(
    () =>
      filter === "unassigned"
        ? tenants.filter((t) => !t.property_id)
        : tenants,
    [tenants, filter],
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            All Tenants
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
          <span>
            {tenants.length} total
            {tenants.length > 0 && (
              <>
                {" — "}
                <span>{assignedCount} assigned</span>
                {", "}
                <span>{unassignedCount} not assigned</span>
              </>
            )}
          </span>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  filter === "all"
                    ? "bg-background shadow-sm font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter("unassigned")}
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  filter === "unassigned"
                    ? "bg-background shadow-sm font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Unassigned ({unassignedCount})
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive text-sm">
            {error}
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tenants yet.</p>
            <p className="text-xs">Use Add Tenant to onboard your first one.</p>
          </div>
        ) : visibleTenants.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <UserX className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No unassigned tenants.</p>
            <p className="text-xs">
              Switch to All to see {tenants.length} assigned tenant
              {tenants.length === 1 ? "" : "s"}.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[420px] pr-4">
            <ul className="space-y-2">
              {visibleTenants.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-md border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{t.tenant_name}</div>
                    <div className="text-xs text-muted-foreground flex flex-col gap-0.5 mt-1">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3 w-3" />
                        {t.contact_number || "—"}
                      </span>
                      {t.email && (
                        <span className="inline-flex items-center gap-1.5 truncate">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          {t.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {t.property_unit_name ? (
                      <Badge variant="secondary" className="gap-1">
                        <Building className="h-3 w-3" />
                        {t.property_unit_name}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <UserX className="h-3 w-3" />
                        Not assigned
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
