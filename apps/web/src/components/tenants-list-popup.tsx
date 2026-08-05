"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Building,
  Clock,
  Loader2,
  Mail,
  Pencil,
  Phone,
  RefreshCw,
  UserX,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import { api } from "@/lib/api-client";
import {
  cancelTransferRequest,
  listLandlordTenants,
} from "@/services/tenantService";
import { EditTenantPopup } from "@/components/edit-tenant-popup";
import { PlaceTenantPopup } from "@/components/place-tenant-popup";
import type { TenantListItem, TransferRequest } from "@unitko/shared";

export type TenantsListFilter = "all" | "unassigned";

interface TenantsListPopupProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-selects the filter when the popup opens. Defaults to "all". */
  initialFilter?: TenantsListFilter;
  /** Fired after an edit lands, so the caller can refresh views that show tenant
   *  identity elsewhere (e.g. the dashboard's occupancy cards). */
  onMutated?: () => void;
}

export function TenantsListPopup({
  isOpen,
  onClose,
  initialFilter = "all",
  onMutated,
}: TenantsListPopupProps) {
  const [editingTenant, setEditingTenant] = useState<TenantListItem | null>(
    null,
  );
  const [placingTenant, setPlacingTenant] = useState<TenantListItem | null>(
    null,
  );
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [pendingByTenant, setPendingByTenant] = useState<
    Map<string, TransferRequest>
  >(new Map());
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(isOpen);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TenantsListFilter>(initialFilter);

  const applyData = useCallback(
    (rows: TenantListItem[], pending: TransferRequest[]) => {
      setTenants(rows);
      setPendingByTenant(new Map(pending.map((r) => [r.tenantId, r])));
      setError(null);
    },
    [],
  );

  // Manual retry from the error state.
  const load = useCallback(() => {
    setLoading(true);
    return Promise.all([listLandlordTenants(), api.tenants.transferRequests()])
      .then(([rows, pending]) => applyData(rows, pending))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load tenants"),
      )
      .finally(() => setLoading(false));
  }, [applyData]);

  const handleCancel = useCallback(
    (requestId: string) => {
      setCancellingId(requestId);
      cancelTransferRequest(requestId)
        .then((res) => {
          if (res.success) {
            toast.success("Transfer cancelled");
            void load();
            onMutated?.();
          } else {
            toast.error("Cancel failed", { description: res.error });
          }
        })
        .finally(() => setCancellingId(null));
    },
    [load, onMutated],
  );

  // Reset the filter to the caller's chosen initial state (and re-enter the
  // loading state when the popup opens) during render — per React's "adjust
  // state on prop change" guidance — so the effect below only triggers the
  // fetch, never a synchronous setState.
  const [anchor, setAnchor] = useState({ open: isOpen, initial: initialFilter });
  if (anchor.open !== isOpen || anchor.initial !== initialFilter) {
    const justOpened = isOpen && !anchor.open;
    setAnchor({ open: isOpen, initial: initialFilter });
    if (isOpen) setFilter(initialFilter);
    if (justOpened) setLoading(true);
  }

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;
    Promise.all([listLandlordTenants(), api.tenants.transferRequests()])
      .then(([rows, pending]) => {
        if (!ignore) applyData(rows, pending);
      })
      .catch((err) => {
        if (!ignore)
          setError(
            err instanceof Error ? err.message : "Failed to load tenants",
          );
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [isOpen, applyData]);

  const unassignedCount = tenants.filter((t) => !t.propertyId).length;
  const assignedCount = tenants.length - unassignedCount;

  const visibleTenants = useMemo(
    () =>
      filter === "unassigned"
        ? tenants.filter((t) => !t.propertyId)
        : tenants,
    [tenants, filter],
  );

  return (
    <>
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
              {visibleTenants.map((t) => {
                const pending = pendingByTenant.get(t.id);
                return (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-md border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{t.tenantName}</div>
                    <div className="text-xs text-muted-foreground flex flex-col gap-0.5 mt-1">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3 w-3" />
                        {t.contactNumber || "—"}
                      </span>
                      {t.email && (
                        <span className="inline-flex items-center gap-1.5 truncate">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          {t.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    {t.propertyName ? (
                      <Badge variant="secondary" className="gap-1">
                        <Building className="h-3 w-3" />
                        {t.propertyName}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <UserX className="h-3 w-3" />
                        Not assigned
                      </Badge>
                    )}
                    {pending ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Transfer pending → {pending.toPropertyName}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setEditingTenant(t)}
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleCancel(pending.id)}
                            disabled={cancellingId === pending.id}
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setEditingTenant(t)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setPlacingTenant(t)}
                        >
                          <ArrowRightLeft className="h-3 w-3 mr-1" />
                          {t.propertyId ? "Transfer" : "Assign"}
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
                );
              })}
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

    {editingTenant && (
      <EditTenantPopup
        key={editingTenant.id}
        tenant={editingTenant}
        isOpen
        onClose={() => setEditingTenant(null)}
        onSaved={(updated) => {
          setTenants((prev) =>
            prev.map((t) => (t.id === updated.id ? updated : t)),
          );
          onMutated?.();
          setEditingTenant(null);
        }}
      />
    )}

    {placingTenant && (
      <PlaceTenantPopup
        key={placingTenant.id}
        tenant={placingTenant}
        isOpen
        onClose={() => setPlacingTenant(null)}
        onPlaced={() => {
          void load();
          onMutated?.();
          setPlacingTenant(null);
        }}
      />
    )}
    </>
  );
}
