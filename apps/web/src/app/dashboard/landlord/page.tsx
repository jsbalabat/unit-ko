"use client";

import { useState, useMemo, useCallback } from "react";
import { withLandlordAuth } from "@/components/auth/withLandlordAuth";
import { SiteHeader } from "@/components/site-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/button";
import {
  Building,
  MapPin,
  Loader2,
  AlertCircle,
  Home,
  Eye,
  Send,
} from "lucide-react";
import { MultiStepPopup } from "@/components/form-add-property";
import { PropertyDetailsPopup } from "@/components/property-details-popup";
import { SendReminderConfirm } from "@/components/send-reminder-confirm";
import {
  AddTenantPopup,
  type AddTenantPropertyOption,
} from "@/components/add-tenant-popup";
import {
  TenantsListPopup,
  type TenantsListFilter,
} from "@/components/tenants-list-popup";
import { useProperties } from "@/hooks/useProperties";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EditPropertyPopup } from "@/components/edit-property-popup";
import { PropertyFilterBar } from "@/components/property-filter-bar";
import { QuickAccessPanel } from "@/components/quick-access-panel";
import { CollapsibleCard } from "@/components/collapsible-card";
import { ShowMoreToggle } from "@/components/show-more-toggle";
import { useShowMore } from "@/hooks/useShowMore";
import { DashboardActions } from "@/components/dashboard-actions";
import { cn } from "@/lib/utils";
import { sendTenantReminder } from "@/services/tenantReminderService";
import type { ReminderChannel } from "@unitko/shared";
import { toast } from "sonner";

function LandlordDashboard() {
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [isAddTenantPopupOpen, setIsAddTenantPopupOpen] = useState(false);
  const [isTenantsListOpen, setIsTenantsListOpen] = useState(false);
  const [tenantsListFilter, setTenantsListFilter] =
    useState<TenantsListFilter>("all");

  const openTenantsList = (filter: TenantsListFilter) => {
    setTenantsListFilter(filter);
    setIsTenantsListOpen(true);
  };
  const [isDetailsPopupOpen, setIsDetailsPopupOpen] = useState(false);
  const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null,
  );
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(
    null,
  );
  const [detailsActiveTab, setDetailsActiveTab] = useState<string>("details");
  const { properties, stats, loading, error, refetch } = useProperties();

  // Rent reminder confirmation dialog state
  const [isReminderConfirmOpen, setIsReminderConfirmOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<{
    tenantName: string;
    tenantPhone: string;
    propertyName: string;
    dueDate: string;
    totalAmount: number;
    billingEntryId: string;
  } | null>(null);
  const [isSendingReminder, setIsSendingReminder] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>(
    [],
  );
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("name-asc");

  const handlePropertyComplete = () => {
    refetch();
  };

  const propertyOptions = useMemo<AddTenantPropertyOption[]>(
    () =>
      properties.map((p) => ({
        id: p.id,
        unit_name: p.unit_name,
        max_tenants: p.max_tenants ?? 1,
        active_tenant_count: (p.tenants || []).filter((t) => t.is_active).length,
      })),
    [properties],
  );

  const handleViewDetails = (propertyId: string, tab: string = "details") => {
    setSelectedPropertyId(propertyId);
    setDetailsActiveTab(tab);
    setIsDetailsPopupOpen(true);
  };

  const handleEditProperty = (propertyId: string) => {
    setEditingPropertyId(propertyId);
    setIsEditPopupOpen(true);
  };

  const handleSendReminder = (
    tenantName: string,
    tenantPhone: string,
    propertyName: string,
    dueDate: string,
    totalAmount: number,
    billingEntryId: string,
  ) => {
    // Open confirmation dialog
    setSelectedReminder({
      tenantName,
      tenantPhone,
      propertyName,
      dueDate,
      totalAmount,
      billingEntryId,
    });
    setIsReminderConfirmOpen(true);
  };

  const handleConfirmSendReminder = async (channel: ReminderChannel) => {
    if (!selectedReminder) return;

    setIsSendingReminder(true);
    try {
      const result = await sendTenantReminder({
        billingEntryId: selectedReminder.billingEntryId,
        tenantName: selectedReminder.tenantName,
        channel,
      });

      if (result.success) {
        toast.success(result.message);
      } else if (result.alreadySentToday) {
        toast.error(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to send reminder. Please try again.",
      );
    } finally {
      setIsSendingReminder(false);
      setSelectedReminder(null);
    }
  };
  const availablePropertyTypes = useMemo(() => {
    const types = properties.map((p) => p.property_type);
    return Array.from(new Set(types)).sort();
  }, [properties]);

  const availableStatuses = useMemo(() => {
    return ["Good Standing", "Needs Monitoring", "Problem / Urgent", "Vacant"];
  }, []);

  // Helper function to get property status (same logic as in the render)
  const getPropertyStatus = useCallback((property: (typeof properties)[0]) => {
    if (property.occupancy_status !== "occupied") {
      return "Vacant";
    }

    const activeTenants = property.tenants.filter(
      (t) => t.is_active,
    ) as ((typeof property.tenants)[0] & {
      billing_entries?: BillingEntry[];
    })[];
    const propertyBillingEntries = activeTenants.flatMap(
      (tenant) => tenant.billing_entries || [],
    );

    if (propertyBillingEntries.length === 0) {
      return "Good Standing";
    }

    const currentDate = new Date();
    const sortedEntries = [...propertyBillingEntries].sort(
      (a, b) => (a.billing_period || 0) - (b.billing_period || 0),
    );

    const relevantEntries = sortedEntries.filter((entry) => {
      const dueDate = new Date(entry.due_date);
      return (
        dueDate.getFullYear() < currentDate.getFullYear() ||
        (dueDate.getFullYear() === currentDate.getFullYear() &&
          dueDate.getMonth() <= currentDate.getMonth())
      );
    });

    if (relevantEntries.length === 0) {
      return "Good Standing";
    }

    const hasUrgentIssues = relevantEntries.some(
      (entry) =>
        entry.status.toLowerCase().includes("problem") ||
        entry.status.toLowerCase().includes("urgent") ||
        entry.status.toLowerCase().includes("overdue"),
    );

    if (hasUrgentIssues) {
      return "Problem / Urgent";
    }

    const needsMonitoring = relevantEntries.some(
      (entry) =>
        entry.status.toLowerCase().includes("monitoring") ||
        entry.status.toLowerCase().includes("delayed") ||
        entry.status.toLowerCase().includes("needs"),
    );

    if (needsMonitoring) {
      return "Needs Monitoring";
    }

    return "Good Standing";
  }, []);

  // Filter and sort properties
  const filteredAndSortedProperties = useMemo(() => {
    let filtered = [...properties];

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.unit_name.toLowerCase().includes(search) ||
          p.property_location.toLowerCase().includes(search) ||
          p.property_type.toLowerCase().includes(search),
      );
    }

    // Apply property type filter
    if (selectedPropertyTypes.length > 0) {
      filtered = filtered.filter((p) =>
        selectedPropertyTypes.includes(p.property_type),
      );
    }

    // Apply status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((p) => {
        const status = getPropertyStatus(p);
        return selectedStatuses.includes(status);
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.unit_name.localeCompare(b.unit_name);
        case "name-desc":
          return b.unit_name.localeCompare(a.unit_name);
        case "rent-asc":
          return a.rent_amount - b.rent_amount;
        case "rent-desc":
          return b.rent_amount - a.rent_amount;
        case "status-occupied":
          return a.occupancy_status === "occupied" ? -1 : 1;
        case "status-vacant":
          return a.occupancy_status === "vacant" ? -1 : 1;
        default:
          return 0;
      }
    });

    return filtered;
  }, [
    properties,
    searchTerm,
    selectedPropertyTypes,
    selectedStatuses,
    sortBy,
    getPropertyStatus,
  ]);

  // Build a consolidated quick access list grouped per tenant with unpaid balance.
  const quickAccessItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items: {
      id: string;
      billingEntryId: string;
      propertyId: string;
      propertyName: string;
      location: string;
      dueDate: string;
      daysOverdue: number;
      unpaidPeriods: number;
      tenantName: string;
      tenantPhone: string;
      totalAmount: number;
      reminderAmount: number;
    }[] = [];

    properties.forEach((property) => {
      const activeTenants = property.tenants.filter(
        (t) => t.is_active,
      ) as ((typeof property.tenants)[0] & {
        billing_entries?: BillingEntry[];
      })[];

      activeTenants.forEach((activeTenant) => {
        if (!activeTenant.billing_entries?.length) {
          return;
        }

        let totalAmount = 0;
        let unpaidPeriods = 0;
        let oldestDueTime: number | null = null;
        // The reminder targets a single invoice — the most overdue one — so its id
        // and gross due drive the dispatch and match the confirm-dialog preview.
        let oldestEntryId: string | null = null;
        let oldestEntryGross = 0;

        activeTenant.billing_entries.forEach((entry) => {
          const dueDate = new Date(entry.due_date);

          if (Number.isNaN(dueDate.getTime())) {
            return;
          }

          const normalizedStatus = entry.status.toLowerCase();
          const paidAmount = entry.paid_amount ?? 0;
          const grossDue = entry.gross_due ?? 0;
          const hasAmountData = grossDue > 0;
          const hasOutstandingBalance = hasAmountData
            ? grossDue - paidAmount > 0.01
            : !normalizedStatus.includes("paid") &&
              !normalizedStatus.includes("settled") &&
              !normalizedStatus.includes("good standing");
          const isSettled =
            normalizedStatus.includes("paid") ||
            normalizedStatus.includes("settled") ||
            normalizedStatus.includes("good standing");
          const isFlaggedOverdue =
            normalizedStatus.includes("overdue") ||
            normalizedStatus.includes("urgent") ||
            normalizedStatus.includes("problem") ||
            normalizedStatus.includes("delayed");
          const isPastDue = dueDate < today;
          const outstandingAmount = hasAmountData
            ? Math.max(0, grossDue - paidAmount)
            : 0;

          if (
            (isPastDue || isFlaggedOverdue) &&
            !isSettled &&
            hasOutstandingBalance
          ) {
            totalAmount += outstandingAmount;
            unpaidPeriods += 1;

            const dueTime = dueDate.getTime();
            if (oldestDueTime === null || dueTime < oldestDueTime) {
              oldestDueTime = dueTime;
              oldestEntryId = entry.id;
              oldestEntryGross = grossDue;
            }
          }
        });

        if (unpaidPeriods > 0 && oldestDueTime !== null && oldestEntryId !== null) {
          const daysOverdue = Math.max(
            1,
            Math.ceil(
              (today.getTime() - oldestDueTime) / (1000 * 60 * 60 * 24),
            ),
          );

          items.push({
            id: `${property.id}-${activeTenant.id}`,
            billingEntryId: oldestEntryId,
            propertyId: property.id,
            propertyName: property.unit_name,
            location: property.property_location,
            dueDate: new Date(oldestDueTime).toISOString(),
            daysOverdue,
            unpaidPeriods,
            tenantName: activeTenant.tenant_name,
            tenantPhone: activeTenant.contact_number,
            totalAmount,
            reminderAmount: oldestEntryGross,
          });
        }
      });
    });

    return items.sort((a, b) => {
      if (b.totalAmount !== a.totalAmount) {
        return b.totalAmount - a.totalAmount;
      }

      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [properties]);

  // Sorted by largest balance first, so the truncated view keeps the tenants
  // worth chasing and hides the tail.
  const {
    visible: visibleOverdue,
    hiddenCount: overdueHiddenCount,
    expanded: overdueExpanded,
    toggle: toggleOverdue,
  } = useShowMore(quickAccessItems, 5);

  // Status colors based on property state
  const getStatusStyles = (status: "occupied" | "vacant") => {
    if (status === "occupied") {
      return {
        indicator: "bg-green-500", // Good standing
        badge:
          "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
        label: "Good Standing",
      };
    } else {
      return {
        indicator: "bg-yellow-500", // Needs monitoring
        badge:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
        label: "Needs Monitoring",
      };
    }
  };

  // Replace the getStatusColor function with a more accurate version
  const getStatusColor = (status: string) => {
    // Normalize status text for consistent comparison
    const normalizedStatus = status.toLowerCase();

    if (normalizedStatus.includes("good standing")) {
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    } else if (
      normalizedStatus.includes("needs monitoring") ||
      normalizedStatus.includes("delayed")
    ) {
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    } else if (
      normalizedStatus.includes("problem") ||
      normalizedStatus.includes("urgent") ||
      normalizedStatus.includes("overdue")
    ) {
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    } else {
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getPropertyIcon = (type: string) => {
    const colors = [
      "text-blue-600 dark:text-blue-400",
      "text-purple-600 dark:text-purple-400",
      "text-orange-600 dark:text-orange-400",
      "text-teal-600 dark:text-teal-400",
      "text-red-600 dark:text-red-400",
    ];
    const index = type.length % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-lg animate-pulse">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-medium">Loading your properties...</span>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="pb-12">
        <div className="container mx-auto px-4 md:px-6 py-6 max-w-7xl">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Property Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your properties and rental agreements
              </p>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Filter Bar */}
          {properties.length > 0 && (
            <div className="mb-6">
              <PropertyFilterBar
                totalCount={properties.length}
                filteredCount={filteredAndSortedProperties.length}
                onSearchChange={setSearchTerm}
                onPropertyTypeChange={setSelectedPropertyTypes}
                onStatusChange={setSelectedStatuses}
                onSortChange={setSortBy}
                availablePropertyTypes={availablePropertyTypes}
                availableStatuses={availableStatuses}
              />
            </div>
          )}

          {/* Quick Stats Section - Ticker Strip */}
          <div className="mb-6 overflow-hidden bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-lg border shadow-sm">
            <div className="overflow-x-auto scrollbar-hide">
              <div className="flex items-center justify-between sm:justify-around py-3 px-4 gap-4 sm:gap-6 min-w-max sm:min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Home className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                      Properties
                    </div>
                    <div className="text-lg font-bold text-primary">
                      {stats.totalProperties}
                    </div>
                  </div>
                </div>

                <div className="h-10 w-px bg-border shrink-0" />

                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                    <Building className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                      Occupied
                    </div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">
                      {stats.activeRentals}
                    </div>
                  </div>
                </div>

                <div className="h-10 w-px bg-border shrink-0" />

                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                      stats.vacantProperties > 0
                        ? "bg-amber-100 dark:bg-amber-900/30"
                        : "bg-muted",
                    )}
                  >
                    <Building
                      className={cn(
                        "h-4 w-4",
                        stats.vacantProperties > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground",
                      )}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                      Vacant
                    </div>
                    <div
                      className={cn(
                        "text-lg font-bold",
                        stats.vacantProperties > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {stats.vacantProperties}
                    </div>
                  </div>
                </div>

                <div className="h-10 w-px bg-border shrink-0" />

                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                    <Building className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                      Revenue
                    </div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400 whitespace-nowrap">
                      ₱{stats.totalRevenue.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Quick Access — one-look panel (actions toolbar, subscription due, reminder cycle, tenant responses) */}
          <div className="mb-6">
            <QuickAccessPanel
              actions={
                <DashboardActions
                  onAddProperty={() => setIsAddPopupOpen(true)}
                  onAddTenant={() => setIsAddTenantPopupOpen(true)}
                  onViewTenants={() => openTenantsList("all")}
                  onViewUnassigned={() => openTenantsList("unassigned")}
                  onRefresh={() => refetch()}
                  refreshing={loading}
                />
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
            {/* Overdue Items Sidebar */}
            <aside className="order-2 lg:order-1">
              <CollapsibleCard
                title="Overdue Balances"
                description={`${quickAccessItems.length} tenant${
                  quickAccessItems.length === 1 ? "" : "s"
                } with unpaid balances`}
                className="lg:sticky lg:top-20"
              >
                {quickAccessItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-3">
                    No unpaid balances right now.
                  </div>
                ) : (
                  <>
                    <ul className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
                      {visibleOverdue.map((item) => (
                        <li
                          key={item.id}
                          className="border rounded-md p-3 bg-muted/20"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold line-clamp-1">
                                {item.propertyName}
                              </p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {item.tenantName} · {item.location}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold px-2 py-1 rounded-full border-2 border-black dark:border-white text-black dark:text-white whitespace-nowrap">
                                {item.daysOverdue}d
                              </span>
                              <span
                                className={cn(
                                  "px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap border-2 border-red-700 dark:border-red-600",
                                  getStatusColor("Overdue"),
                                )}
                              >
                                Overdue
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-start justify-between gap-2 text-xs">
                            <div className="text-muted-foreground">
                              <div>
                                Due{" "}
                                {new Date(item.dueDate).toLocaleDateString()}
                              </div>
                              <div className="text-[11px]">
                                {item.unpaidPeriods} unpaid period
                                {item.unpaidPeriods === 1 ? "" : "s"}
                              </div>
                              <div className="text-[11px] font-semibold text-red-700 dark:text-red-300">
                                Unpaid Balance: ₱
                                {item.totalAmount.toLocaleString()}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() =>
                                  handleSendReminder(
                                    item.tenantName,
                                    item.tenantPhone,
                                    item.propertyName,
                                    item.dueDate,
                                    item.reminderAmount,
                                    item.billingEntryId,
                                  )
                                }
                                title="Send rent reminder"
                                disabled={isSendingReminder}
                              >
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() =>
                                  handleViewDetails(item.propertyId, "finances")
                                }
                                title="View statement of account"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <ShowMoreToggle
                      expanded={overdueExpanded}
                      hiddenCount={overdueHiddenCount}
                      onToggle={toggleOverdue}
                    />
                  </>
                )}
              </CollapsibleCard>
            </aside>

            <div className="order-1 lg:order-2">
              {/* Empty State */}
              {properties.length === 0 && !loading && (
                <div className="text-center py-10 px-4 border rounded-xl bg-muted/20 mb-6">
                  <Building className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">
                    No Properties Yet
                  </h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Use the actions above to add your first property, or onboard a
                    tenant to assign later.
                  </p>
                </div>
              )}

              {/* Individual Property Cards Grid */}
              {properties.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
                  {filteredAndSortedProperties.map((property) => {
                    const activeTenants = property.tenants.filter(
                      (t) => t.is_active,
                    ) as ((typeof property.tenants)[0] & {
                      billing_entries?: BillingEntry[];
                    })[];

                    const propertyBillingEntries = activeTenants.flatMap(
                      (tenant) => tenant.billing_entries || [],
                    );

                    const tenantProfiles = activeTenants.map((tenant) => ({
                      name: tenant.tenant_name,
                    }));

                    const totalSlots =
                      property.max_tenants ?? activeTenants.length;

                    // Headcount is who is assigned to the unit, so it counts
                    // tenants directly. Deliberately not gated on
                    // occupancy_status, which the server derives from active
                    // *leases* — a tenant added before their lease exists is
                    // still a person in the unit, and gating on the lease
                    // rendered "0/4" directly beside that tenant's own name.
                    const occupancyCount = activeTenants.length;

                    // Get the status for this property
                    const propertyStatus = (() => {
                      if (property.occupancy_status !== "occupied") {
                        // Tenants assigned but no active lease is a real state
                        // with an action attached (write the lease), not the
                        // same thing as an empty unit. Labelling both "Vacant"
                        // read as a bug next to a populated tenant list.
                        return {
                          text: activeTenants.length > 0
                            ? "No Active Lease"
                            : "Vacant",
                          color: getStatusColor("Neutral / Administrative"),
                        };
                      }

                      // If no billing entries, return Good Standing
                      if (
                        !propertyBillingEntries ||
                        propertyBillingEntries.length === 0
                      ) {
                        return {
                          text: "Good Standing",
                          color: getStatusColor("Good Standing"),
                        };
                      }

                      // Get current date for comparison
                      const currentDate = new Date();

                      // Sort billing entries by billing period (month number)
                      const sortedEntries = [...propertyBillingEntries].sort(
                        (a, b) =>
                          (a.billing_period || 0) - (b.billing_period || 0),
                      );

                      // Find entries up to the current month
                      const relevantEntries = sortedEntries.filter((entry) => {
                        const dueDate = new Date(entry.due_date);
                        // Include entries for this month and previous months
                        return (
                          dueDate.getFullYear() < currentDate.getFullYear() ||
                          (dueDate.getFullYear() ===
                            currentDate.getFullYear() &&
                            dueDate.getMonth() <= currentDate.getMonth())
                        );
                      });

                      // If no relevant entries (all future), show Good Standing
                      if (relevantEntries.length === 0) {
                        return {
                          text: "Good Standing",
                          color: getStatusColor("Good Standing"),
                        };
                      }

                      // Check if any relevant entries have Problem/Urgent status
                      const hasUrgentIssues = relevantEntries.some(
                        (entry) =>
                          entry.status.toLowerCase().includes("problem") ||
                          entry.status.toLowerCase().includes("urgent") ||
                          entry.status.toLowerCase().includes("overdue"),
                      );

                      if (hasUrgentIssues) {
                        return {
                          text: "Problem / Urgent",
                          color: getStatusColor("Problem / Urgent"),
                        };
                      }

                      // Check if any relevant entries need monitoring
                      const needsMonitoring = relevantEntries.some(
                        (entry) =>
                          entry.status.toLowerCase().includes("monitoring") ||
                          entry.status.toLowerCase().includes("delayed") ||
                          entry.status.toLowerCase().includes("needs"),
                      );

                      if (needsMonitoring) {
                        return {
                          text: "Needs Monitoring",
                          color: getStatusColor("Needs Monitoring"),
                        };
                      }

                      // If all relevant entries are in Good Standing, return Good Standing
                      return {
                        text: "Good Standing",
                        color: getStatusColor("Good Standing"),
                      };
                    })();

                    return (
                      <Card
                        key={property.id}
                        className="transition-all hover:shadow-md overflow-x-hidden"
                      >
                        <div
                          className={cn(
                            "h-1.5",
                            getStatusStyles(property.occupancy_status)
                              .indicator,
                          )}
                        />
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg line-clamp-1 flex items-center gap-2">
                              <Building
                                className={`h-5 w-5 flex-shrink-0 ${getPropertyIcon(
                                  property.property_type,
                                )}`}
                              />
                              {property.unit_name}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-3"
                                onClick={() => handleViewDetails(property.id)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Details
                              </Button>
                            </div>
                          </div>
                          <CardDescription className="flex items-center text-xs min-w-0">
                            <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span
                              className="block min-w-0 truncate"
                              title={property.property_location}
                            >
                              {property.property_location}
                            </span>
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2.5 pb-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">
                              Monthly Rent per Tenant
                            </span>
                            <div className="text-right">
                              <div className="font-medium text-green-600 dark:text-green-400">
                                ~ ₱{property.rent_amount.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">
                              Property Type
                            </span>
                            <span className="font-medium text-sm">
                              {property.property_type}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">
                              Tenant Occupancy
                            </span>
                            {tenantProfiles.length > 0 ? (
                              <div className="group">
                                <span
                                  className={`font-medium text-sm cursor-help ${
                                    occupancyCount > totalSlots
                                      ? "text-amber-600 dark:text-amber-400"
                                      : ""
                                  }`}
                                  title={
                                    occupancyCount > totalSlots
                                      ? "Over capacity — adjust capacity in Edit Property or remove tenants"
                                      : undefined
                                  }
                                >
                                  {occupancyCount}/
                                  {totalSlots || occupancyCount}
                                  {occupancyCount > totalSlots && (
                                    <span className="ml-1">⚠</span>
                                  )}
                                </span>
                                {/* Hover tooltip - positioned upwards - wrapper technique */}
                                <span className="absolute invisible group-hover:visible z-[100]">
                                  <span className="relative block right-0 bottom-full mb-1 bg-popover shadow-lg rounded-md p-3 min-w-[200px] border">
                                    <div className="text-xs font-medium mb-2">
                                      Tenants:
                                    </div>
                                    <div className="space-y-1">
                                      {tenantProfiles.map((person, idx) => (
                                        <div key={idx} className="text-xs">
                                          {person.name &&
                                          person.name.trim() !== "" ? (
                                            <span>
                                              {idx + 1}. {person.name}
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground">
                                              {idx + 1}.{" "}
                                              <span className="italic">
                                                Slot Vacant
                                              </span>
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </span>
                                </span>
                              </div>
                            ) : (
                              <span className="font-medium text-sm">
                                {property.occupancy_status === "occupied"
                                  ? "1/1"
                                  : "0/0"}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">
                              Status
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${propertyStatus.color}`}
                            >
                              {propertyStatus.text}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Multi-Step Popup for Adding Property */}
      <MultiStepPopup
        isOpen={isAddPopupOpen}
        onClose={() => setIsAddPopupOpen(false)}
        onComplete={handlePropertyComplete}
      />

      {/* Add Tenant Popup (with optional property assignment) */}
      <AddTenantPopup
        isOpen={isAddTenantPopupOpen}
        onClose={() => setIsAddTenantPopupOpen(false)}
        onCreated={() => refetch()}
        properties={propertyOptions}
      />

      {/* Tenants list */}
      <TenantsListPopup
        isOpen={isTenantsListOpen}
        onClose={() => setIsTenantsListOpen(false)}
        initialFilter={tenantsListFilter}
        onMutated={() => refetch(true)}
      />

      {/* Property Details Popup */}
      {selectedPropertyId && (
        <PropertyDetailsPopup
          propertyId={selectedPropertyId}
          isOpen={isDetailsPopupOpen}
          onClose={() => {
            setIsDetailsPopupOpen(false);
            setSelectedPropertyId(null);
          }}
          onEdit={handleEditProperty}
          // SILENT refresh: a nested save must not re-enter the dashboard's
          // loading skeleton, which would unmount this popup (and any billing/
          // edit popup open within it). Refresh in place; closing stays explicit
          // via onClose.
          onSuccess={() => {
            refetch(true);
          }}
          defaultTab={detailsActiveTab}
        />
      )}

      {/* Edit Property Popup */}
      {editingPropertyId && (
        <EditPropertyPopup
          propertyId={editingPropertyId}
          isOpen={isEditPopupOpen}
          onClose={() => {
            setIsEditPopupOpen(false);
            setEditingPropertyId(null);
          }}
          onSuccess={() => {
            refetch();
            setIsEditPopupOpen(false);
            setEditingPropertyId(null);
          }}
        />
      )}

      {/* Send Reminder Confirmation Dialog */}
      {selectedReminder && (
        <SendReminderConfirm
          isOpen={isReminderConfirmOpen}
          onOpenChange={setIsReminderConfirmOpen}
          onConfirm={handleConfirmSendReminder}
          tenantName={selectedReminder.tenantName}
          tenantPhone={selectedReminder.tenantPhone}
          propertyName={selectedReminder.propertyName}
          dueDate={selectedReminder.dueDate}
          totalAmount={selectedReminder.totalAmount}
          isLoading={isSendingReminder}
        />
      )}
    </>
  );
}

// First, let's update your BillingEntry interface at the top of the file to match what's coming from the database
interface BillingEntry {
  id: string;
  status: string;
  due_date: string;
  billing_period?: number;
  paid_amount?: number;
  gross_due?: number;
}

export default withLandlordAuth(LandlordDashboard);
