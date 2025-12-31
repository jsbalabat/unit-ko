"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Calendar,
  DollarSign,
  Home,
  Mail,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import {
  fetchTenantDashboardData,
  TenantDashboardData,
} from "@/services/tenantService";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/button";

export default function TenantDashboard() {
  const router = useRouter();
  const [dashboardData, setDashboardData] =
    useState<TenantDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      // Check if tenant is authenticated
      const tenantId = sessionStorage.getItem("tenantId");

      if (!tenantId) {
        router.push("/auth/tenant/login");
        return;
      }

      try {
        const data = await fetchTenantDashboardData(tenantId);

        if (data) {
          setDashboardData(data);
        } else {
          router.push("/auth/tenant/login");
        }
      } catch (error) {
        console.error("Error loading dashboard:", error);
        router.push("/auth/tenant/login");
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem("tenantId");
    sessionStorage.removeItem("tenantEmail");
    router.push("/auth/tenant/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const { tenant, property, billingEntries } = dashboardData;

  // Calculate billing summary
  const paidBills = billingEntries.filter(
    (entry) => entry.status === "paid"
  ).length;
  const pendingBills = billingEntries.filter(
    (entry) => entry.status === "pending"
  ).length;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tenant Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {tenant.tenant_name}
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* Tenant & Property Information Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Tenant Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Your Information
              </CardTitle>
              <CardDescription>
                Personal details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Full Name</p>
                    <p className="text-sm text-muted-foreground">
                      {tenant.tenant_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email Address</p>
                    <p className="text-sm text-muted-foreground">
                      {tenant.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Contact Number</p>
                    <p className="text-sm text-muted-foreground">
                      {tenant.contact_number}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Contract Duration</p>
                    <p className="text-sm text-muted-foreground">
                      {tenant.contract_months} months
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Rent Start Date</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(tenant.rent_start_date).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Payment Due Day</p>
                    <p className="text-sm text-muted-foreground">
                      Every {tenant.due_day} of the month
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Property Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Property Details
              </CardTitle>
              <CardDescription>
                Information about your rental unit
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Home className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Unit Name</p>
                    <p className="text-sm text-muted-foreground">
                      {property.unit_name}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Property Type</p>
                    <Badge variant="outline" className="capitalize">
                      {property.property_type}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Location</p>
                    <p className="text-sm text-muted-foreground">
                      {property.property_location}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="rounded-lg bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Monthly Rent</p>
                      <p className="text-xs text-muted-foreground">
                        Base rent amount
                      </p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    ₱{property.rent_amount.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Billing Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Billing Summary
            </CardTitle>
            <CardDescription>Overview of your rental payments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Total Billing Entries
                </p>
                <p className="text-2xl font-bold mt-1">
                  {billingEntries.length}
                </p>
              </div>
              <div className="rounded-lg border p-4 bg-green-50 dark:bg-green-950">
                <p className="text-sm font-medium text-muted-foreground">
                  Paid Bills
                </p>
                <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
                  {paidBills}
                </p>
              </div>
              <div className="rounded-lg border p-4 bg-amber-50 dark:bg-amber-950">
                <p className="text-sm font-medium text-muted-foreground">
                  Pending Bills
                </p>
                <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                  {pendingBills}
                </p>
              </div>
            </div>

            {billingEntries.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Payment History</h3>
                <div className="space-y-2">
                  {billingEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            Billing Period {entry.billing_period}
                          </p>
                          <Badge
                            variant={
                              entry.status === "paid" ? "default" : "secondary"
                            }
                            className={
                              entry.status === "paid"
                                ? "bg-green-500"
                                : "bg-amber-500"
                            }
                          >
                            {entry.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Due:{" "}
                          {new Date(entry.due_date).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            }
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">
                          ₱{entry.gross_due.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Rent: ₱{entry.rent_due.toLocaleString()} + Charges: ₱
                          {entry.other_charges.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No billing entries found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
