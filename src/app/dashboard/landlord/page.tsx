"use client";

import { useState, useMemo, useCallback } from "react";
import { withLandlordAuth } from "@/components/auth/withLandlordAuth";
import { SiteHeader } from "@/components/site-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/button";
import {
  Building,
  MapPin,
  Loader2,
  AlertCircle,
  Plus,
  Home,
  Eye,
} from "lucide-react";
import { MultiStepPopup } from "@/components/form-add-property";
import { PropertyDetailsPopup } from "@/components/property-details-popup";
import { useProperties } from "@/hooks/useProperties";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EditPropertyPopup } from "@/components/edit-property-popup";
import { PropertyFilterBar } from "@/components/property-filter-bar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function LandlordDashboard() {
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [isDetailsPopupOpen, setIsDetailsPopupOpen] = useState(false);
  const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null,
  );
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(
    null,
  );
  const { properties, stats, loading, error, refetch } = useProperties();

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>(
    [],
  );
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("name-asc");

  const handlePropertyComplete = (data: { unitName?: string } | unknown) => {
    const propertyName =
      typeof data === "object" && data && "unitName" in data
        ? data.unitName
        : "New property";

    toast.success(`Successfully added property: ${propertyName}`);
    refetch();
  };

  const handleViewDetails = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setIsDetailsPopupOpen(true);
  };

  const handleEditProperty = (propertyId: string) => {
    setEditingPropertyId(propertyId);
    setIsEditPopupOpen(true);
  };

  // Get unique property types and statuses from properties
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

    const activeTenant = property.tenants.find((t) => t.is_active) as
      | ((typeof property.tenants)[0] & { billing_entries?: BillingEntry[] })
      | undefined;

    if (
      !activeTenant ||
      !activeTenant.billing_entries ||
      activeTenant.billing_entries.length === 0
    ) {
      return "Good Standing";
    }

    const currentDate = new Date();
    const sortedEntries = [...activeTenant.billing_entries].sort(
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

          {/* Empty State */}
          {properties.length === 0 && !loading && (
            <div className="text-center py-10 px-4 border rounded-xl bg-muted/20 mb-6">
              <Building className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">No Properties Yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-4">
                Start building your property portfolio by adding your first
                property.
              </p>
              <Button onClick={() => setIsAddPopupOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add Your First Property
              </Button>
            </div>
          )}

          {/* Individual Property Cards Grid */}
          {properties.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {filteredAndSortedProperties.map((property) => {
                const activeTenant = property.tenants.find(
                  (t) => t.is_active,
                ) as (typeof property.tenants)[0] & {
                  billing_entries?: BillingEntry[];
                };

                // Get the status for this property
                const propertyStatus = (() => {
                  if (
                    property.occupancy_status !== "occupied" ||
                    !activeTenant
                  ) {
                    return {
                      text: "Vacant",
                      color: getStatusColor("Neutral / Administrative"),
                    };
                  }

                  // If no billing entries, return Good Standing
                  if (
                    !activeTenant.billing_entries ||
                    activeTenant.billing_entries.length === 0
                  ) {
                    return {
                      text: "Good Standing",
                      color: getStatusColor("Good Standing"),
                    };
                  }

                  // Get current date for comparison
                  const currentDate = new Date();

                  // Sort billing entries by billing period (month number)
                  const sortedEntries = [...activeTenant.billing_entries].sort(
                    (a, b) => (a.billing_period || 0) - (b.billing_period || 0),
                  );

                  // Find entries up to the current month
                  const relevantEntries = sortedEntries.filter((entry) => {
                    const dueDate = new Date(entry.due_date);
                    // Include entries for this month and previous months
                    return (
                      dueDate.getFullYear() < currentDate.getFullYear() ||
                      (dueDate.getFullYear() === currentDate.getFullYear() &&
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

                // Count only filled-in pax_details entries
                const filledPaxCount =
                  activeTenant?.pax_details?.filter(
                    (p) => p.name && p.name.trim() !== "",
                  ).length || 0;
                const paxCount =
                  filledPaxCount > 0 ? filledPaxCount : activeTenant?.pax || 0;
                const occupancyText =
                  property.occupancy_status === "occupied" && paxCount > 0
                    ? `${paxCount} ${paxCount === 1 ? "person" : "people"}`
                    : "Vacant";

                const perPersonRent =
                  property.occupancy_status === "occupied" && paxCount > 1
                    ? property.rent_amount / paxCount
                    : null;

                return (
                  <Card
                    key={property.id}
                    className="transition-all hover:shadow-md overflow-x-hidden"
                  >
                    <div
                      className={cn(
                        "h-1.5",
                        getStatusStyles(property.occupancy_status).indicator,
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
                      <CardDescription className="flex items-center text-xs">
                        <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="truncate">
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
                        {activeTenant &&
                        activeTenant.pax_details &&
                        activeTenant.pax_details.length > 0 ? (
                          <div className="group">
                            <span className="font-medium text-sm cursor-help">
                              {filledPaxCount}/{activeTenant.pax_details.length}
                            </span>
                            {/* Hover tooltip - positioned upwards - wrapper technique */}
                            <span className="absolute invisible group-hover:visible z-[100]">
                              <span className="relative block right-0 bottom-full mb-1 bg-popover shadow-lg rounded-md p-3 min-w-[200px] border">
                                <div className="text-xs font-medium mb-2">
                                  Tenants:
                                </div>
                                <div className="space-y-1">
                                  {activeTenant.pax_details.map(
                                    (person, idx) => (
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
                                    ),
                                  )}
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

              {/* Add New Property Card */}
              <Card className="border-dashed hover:border-solid transition-all cursor-pointer bg-muted/10 hover:bg-muted/20">
                <CardContent className="flex flex-col items-center justify-center h-full py-8">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium mb-1.5">
                    Add New Property
                  </h3>
                  <p className="text-muted-foreground text-center text-sm mb-4 max-w-[250px]">
                    Expand your portfolio with another rental property
                  </p>
                  <Button
                    onClick={() => setIsAddPopupOpen(true)}
                    variant="outline"
                    size="sm"
                  >
                    Add Property
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* Multi-Step Popup for Adding Property */}
      <MultiStepPopup
        isOpen={isAddPopupOpen}
        onClose={() => setIsAddPopupOpen(false)}
        onComplete={handlePropertyComplete}
      />

      {/* Property Details Popup */}
      {selectedPropertyId && (
        <PropertyDetailsPopup
          propertyId={selectedPropertyId}
          isOpen={isDetailsPopupOpen}
          onClose={() => setIsDetailsPopupOpen(false)}
          onEdit={handleEditProperty}
          onSuccess={() => {
            refetch();
            setSelectedPropertyId(null);
          }}
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
    </>
  );
}

// New StatCard component for better UI
interface StatCardProps {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  trend?: "positive" | "negative" | "warning" | "neutral";
}

function StatCard({ title, value, icon, trend = "neutral" }: StatCardProps) {
  const trendColors = {
    positive: "text-green-600 dark:text-green-400",
    negative: "text-red-600 dark:text-red-400",
    warning: "text-amber-600 dark:text-amber-400",
    neutral: "text-primary",
  };

  return (
    <Card>
      <CardContent className="py-1 px-3 flex flex-col">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">
            {title}
          </span>
          {icon && (
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
              {icon}
            </div>
          )}
        </div>
        <div className={cn("text-xl font-bold mt-1.5", trendColors[trend])}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

// First, let's update your BillingEntry interface at the top of the file to match what's coming from the database
interface BillingEntry {
  id: string;
  status: string;
  due_date: string;
  billing_period?: number;
}

export default withLandlordAuth(LandlordDashboard);
