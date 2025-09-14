"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
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
  Edit,
} from "lucide-react";
import { MultiStepPopup } from "@/components/form-add-property";
import { PropertyDetailsPopup } from "@/components/property-details-popup";
import { useProperties } from "@/hooks/useProperties";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EditPropertyPopup } from "@/components/edit-property-popup";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function LandlordDashboard() {
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [isDetailsPopupOpen, setIsDetailsPopupOpen] = useState(false);
  const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null
  );
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(
    null
  );
  const { properties, stats, loading, error, refetch } = useProperties();

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
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <main className="h-[calc(100vh-var(--header-height))] flex items-center justify-center">
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-lg animate-pulse">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-medium">Loading your properties...</span>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
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

            {/* Quick Stats Section */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-6">
              <StatCard
                title="Properties"
                value={stats.totalProperties}
                icon={<Home className="h-4 w-4" />}
                trend="neutral"
              />
              <StatCard
                title="Occupied"
                value={stats.activeRentals}
                icon={<Building className="h-4 w-4" />}
                trend="positive"
              />
              <StatCard
                title="Vacant"
                value={stats.vacantProperties}
                icon={<Building className="h-4 w-4" />}
                trend={stats.vacantProperties > 0 ? "warning" : "neutral"}
              />
              <StatCard
                title="Revenue"
                value={`₱${stats.totalRevenue.toLocaleString()}`}
                icon={<Building className="h-4 w-4" />}
                trend="positive"
              />
            </div>

            {/* Empty State */}
            {properties.length === 0 && !loading && (
              <div className="text-center py-10 px-4 border rounded-xl bg-muted/20 mb-6">
                <Building className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">
                  No Properties Yet
                </h3>
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
                {properties.map((property) => {
                  const activeTenant = property.tenants.find(
                    (t) => t.is_active
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
                    const sortedEntries = [
                      ...activeTenant.billing_entries,
                    ].sort(
                      (a, b) =>
                        (a.billing_period || 0) - (b.billing_period || 0)
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
                        entry.status.toLowerCase().includes("overdue")
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
                        entry.status.toLowerCase().includes("needs")
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

                  const occupancyText =
                    property.occupancy_status === "occupied"
                      ? `${activeTenant ? 1 : 0}/1 unit`
                      : "0/1 unit";

                  return (
                    <Card
                      key={property.id}
                      className="overflow-hidden transition-all hover:shadow-md"
                    >
                      <div
                        className={cn(
                          "h-1.5",
                          getStatusStyles(property.occupancy_status).indicator
                        )}
                      />
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg line-clamp-1">
                            {property.unit_name}
                          </CardTitle>
                          <Building
                            className={`h-5 w-5 flex-shrink-0 ${getPropertyIcon(
                              property.property_type
                            )}`}
                          />
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
                            Monthly Rent
                          </span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            ₱{property.rent_amount.toLocaleString()}
                          </span>
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
                            Occupancy
                          </span>
                          <span className="font-medium text-sm">
                            {occupancyText}
                          </span>
                        </div>
                        {activeTenant && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">
                              Tenant
                            </span>
                            <span className="font-medium text-sm truncate max-w-[150px]">
                              {activeTenant.tenant_name}
                            </span>
                          </div>
                        )}
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
                      <CardFooter className="flex gap-2 pt-2 border-t bg-muted/10">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1 h-9"
                          onClick={() => handleViewDetails(property.id)}
                        >
                          <Eye className="h-4 w-4 mr-1.5" />
                          Details
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1 h-9"
                          onClick={() => handleEditProperty(property.id)}
                        >
                          <Edit className="h-4 w-4 mr-1.5" />
                          Edit
                        </Button>
                      </CardFooter>
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
      </SidebarInset>

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
    </SidebarProvider>
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
      <CardContent className="p-4 flex flex-col">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground font-medium">
            {title}
          </span>
          {icon && (
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              {icon}
            </div>
          )}
        </div>
        <div className={cn("text-2xl font-bold mt-2", trendColors[trend])}>
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
