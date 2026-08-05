"use client";

import { Building, Plus, Eye, UserX, RefreshCw } from "lucide-react";
import { Button } from "@/components/button";

interface DashboardActionsProps {
  onAddProperty: () => void;
  onAddTenant: () => void;
  onViewTenants: () => void;
  onViewUnassigned: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

// The single portfolio action toolbar. Previously duplicated across the dashboard
// empty-state and the Quick-Add card; consolidated here and hosted in the Quick
// Access panel so there's one source that can't drift.
export function DashboardActions({
  onAddProperty,
  onAddTenant,
  onViewTenants,
  onViewUnassigned,
  onRefresh,
  refreshing = false,
}: DashboardActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={onAddProperty}>
        <Building className="h-4 w-4 mr-2" />
        Add Property
      </Button>
      <Button size="sm" variant="outline" onClick={onAddTenant}>
        <Plus className="h-4 w-4 mr-2" />
        Add Tenant
      </Button>
      <Button size="sm" variant="outline" onClick={onViewTenants}>
        <Eye className="h-4 w-4 mr-2" />
        View Tenants
      </Button>
      <Button size="sm" variant="outline" onClick={onViewUnassigned}>
        <UserX className="h-4 w-4 mr-2" />
        Unassigned
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onRefresh}
        disabled={refreshing}
      >
        <RefreshCw
          className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
        />
        Refresh
      </Button>
    </div>
  );
}
