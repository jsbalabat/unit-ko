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
import { Building, MapPin, Loader2, AlertCircle } from "lucide-react";
import { MultiStepPopup } from "@/components/form-add-property";
import { useProperties } from "@/hooks/useProperties";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LandlordDashboard() {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const { properties, stats, loading, error, refetch } = useProperties();

  const handlePropertyComplete = (data: unknown) => {
    console.log("New property data:", data);
    // Refetch data to update the dashboard
    refetch();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "occupied":
        return "bg-green-100 text-green-800";
      case "vacant":
        return "bg-yellow-100 text-yellow-800";
      case "maintenance":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPropertyIcon = (type: string) => {
    const colors = [
      "text-blue-600",
      "text-purple-600",
      "text-orange-600",
      "text-teal-600",
      "text-red-600",
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
          <main>
            <div className="container mx-auto px-8 lg:px-0 py-8">
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Loading your properties...</span>
                </div>
              </div>
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
        <main>
          <div className="container mx-auto px-8 lg:px-0 py-8 space-y-8">
            {/* Welcome Section */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">
                Welcome to your Dashboard!
              </h1>
              <p className="text-gray-600">
                Manage your properties and rental agreements
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Quick Stats Section - Updated with real data */}
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-6 mb-8">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>Total Properties</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  {stats.totalProperties}
                </CardContent>
              </Card>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>Active Rentals</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  {stats.activeRentals}
                </CardContent>
              </Card>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>Vacant Properties</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  {stats.vacantProperties}
                </CardContent>
              </Card>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>Total Revenue</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  ₱{stats.totalRevenue.toLocaleString()}
                </CardContent>
              </Card>
            </div>

            {/* Individual Property Cards Grid - Updated with real data */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {properties.map((property) => {
                const activeTenant = property.tenants.find((t) => t.is_active);
                const occupancyText =
                  property.occupancy_status === "occupied"
                    ? `${activeTenant ? 1 : 0}/1 unit`
                    : "0/1 unit";

                return (
                  <Card
                    key={property.id}
                    className="hover:shadow-lg transition-shadow"
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          {property.unit_name}
                        </CardTitle>
                        <Building
                          className={`h-5 w-5 ${getPropertyIcon(
                            property.property_type
                          )}`}
                        />
                      </div>
                      <CardDescription className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        {property.property_location}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          Monthly Rent
                        </span>
                        <span className="font-semibold text-green-600">
                          ₱{property.rent_amount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          Property Type
                        </span>
                        <span className="font-semibold">
                          {property.property_type}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Occupancy</span>
                        <span className="font-semibold">{occupancyText}</span>
                      </div>
                      {activeTenant && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Tenant</span>
                          <span className="font-semibold text-sm">
                            {activeTenant.tenant_name}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Status</span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${getStatusColor(
                            property.occupancy_status
                          )}`}
                        >
                          {property.occupancy_status === "occupied"
                            ? "Occupied"
                            : "Available"}
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter className="flex gap-2">
                      <Button size="sm" className="flex-1">
                        View Details
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        Edit
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            {/* Empty State */}
            {properties.length === 0 && !loading && (
              <div className="text-center py-12">
                <Building className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  No Properties Yet
                </h3>
                <p className="text-gray-600 mb-4">
                  Start building your property portfolio by adding your first
                  property.
                </p>
                <Button onClick={() => setIsPopupOpen(true)}>
                  Add Your First Property
                </Button>
              </div>
            )}

            {/* Add New Property Card */}
            {properties.length > 0 && (
              <div className="mt-8">
                <Card className="border-dashed border-2 hover:border-solid transition-all cursor-pointer">
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <Building className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      Add New Property
                    </h3>
                    <p className="text-gray-600 text-center mb-4">
                      Expand your portfolio by adding a new rental property
                    </p>
                    <Button onClick={() => setIsPopupOpen(true)}>
                      Add Property
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </SidebarInset>

      {/* Multi-Step Popup */}
      <MultiStepPopup
        isOpen={isPopupOpen}
        onClose={() => setIsPopupOpen(false)}
        onComplete={handlePropertyComplete}
      />
    </SidebarProvider>
  );
}
