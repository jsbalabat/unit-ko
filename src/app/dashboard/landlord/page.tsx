// import { Button } from "@/components/ui/button";
// import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Card,
  // CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/button";
import { Building, MapPin } from "lucide-react";

export default function LandlordDashboard() {
  return (
    // Landing Page

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
          {/* Dashboard Container with increased side spacing */}
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
            {/* Quick Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-6 mb-8">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>Total Properties</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">12</CardContent>
              </Card>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>Active Rentals</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">8</CardContent>
              </Card>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>Pending Payments</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">3</CardContent>
              </Card>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>Total Revenue</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                  ₱150,000
                </CardContent>
              </Card>
            </div>
            {/* Individual Property Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Property 1 - Apartment Complex */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Sunset Apartments</CardTitle>
                    <Building className="h-5 w-5 text-blue-600" />
                  </div>
                  <CardDescription className="flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    123 Main St, Quezon City
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Monthly Rent</span>
                    <span className="font-semibold text-green-600">
                      ₱25,000
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Occupancy</span>
                    <span className="font-semibold">8/10 units</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                      Active
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

              {/* Property 2 - Single House */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Modern Villa</CardTitle>
                    <Building className="h-5 w-5 text-purple-600" />
                  </div>
                  <CardDescription className="flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    456 Oak Ave, Makati City
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Monthly Rent</span>
                    <span className="font-semibold text-green-600">
                      ₱45,000
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Occupancy</span>
                    <span className="font-semibold">1/1 unit</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                      Occupied
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

              {/* Property 3 - Commercial Space */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">City Plaza Office</CardTitle>
                    <Building className="h-5 w-5 text-orange-600" />
                  </div>
                  <CardDescription className="flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    789 Business District, BGC
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Monthly Rent</span>
                    <span className="font-semibold text-green-600">
                      ₱80,000
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Occupancy</span>
                    <span className="font-semibold">0/1 unit</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                      Available
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

              {/* Property 4 - Condo Unit */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Skyline Condo</CardTitle>
                    <Building className="h-5 w-5 text-teal-600" />
                  </div>
                  <CardDescription className="flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    321 High St, Ortigas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Monthly Rent</span>
                    <span className="font-semibold text-green-600">
                      ₱35,000
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Occupancy</span>
                    <span className="font-semibold">1/1 unit</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Status</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                      Under Maintenance
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
            </div>

            {/* Add New Property Card */}
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
                  <Button>Add Property</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
