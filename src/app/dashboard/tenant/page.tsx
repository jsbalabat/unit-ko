"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { withTenantAuth } from "@/components/auth/withTenantAuth";
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
  Home,
  Mail,
  MapPin,
  Phone,
  User,
  CreditCard,
  Wallet,
  Banknote,
  AlertCircle,
} from "lucide-react";
import {
  fetchTenantDashboardData,
  TenantDashboardData,
} from "@/services/tenantService";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { LandlordPaymentInfo } from "@/components/landlord-payment-info";

function TenantDashboard() {
  const router = useRouter();
  const [dashboardData, setDashboardData] =
    useState<TenantDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedBilling, setSelectedBilling] = useState<any>(null);
  const [isTraditionalPaymentOpen, setIsTraditionalPaymentOpen] =
    useState(false);

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

  const handlePayNow = (billing: any) => {
    setSelectedBilling(billing);
    setIsPaymentDialogOpen(true);
  };

  const handleDigitalPayment = (method: string) => {
    toast.info(`Redirecting to ${method}...`);
    // In production, integrate with actual payment gateway
    setTimeout(() => {
      window.open("https://www.gcash.com", "_blank");
    }, 500);
  };

  const handleNotifyLandlordTraditional = () => {
    setIsPaymentDialogOpen(false);
    setIsTraditionalPaymentOpen(true);
  };

  const handleSendTraditionalNotification = () => {
    toast.success(
      "Landlord notified! They will contact you to arrange payment.",
    );
    setIsTraditionalPaymentOpen(false);
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
    (entry) => entry.status === "paid",
  ).length;
  const pendingBills = billingEntries.filter(
    (entry) => entry.status === "pending",
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
                        },
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

        {/* Landlord Payment Information */}
        <LandlordPaymentInfo propertyId={property.id} />

        {/* Billing Summary Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Billing Summary
                </CardTitle>
                <CardDescription>
                  Overview of your rental payments
                </CardDescription>
              </div>
              {billingEntries.length > 0 && (
                <Button
                  size="default"
                  onClick={() => {
                    const nextPendingBill = billingEntries.find(
                      (entry) => entry.status === "pending",
                    );
                    if (nextPendingBill) {
                      handlePayNow(nextPendingBill);
                    } else {
                      // If no pending bills, show the first bill
                      handlePayNow(billingEntries[0]);
                    }
                  }}
                  className="flex items-center gap-2 w-full sm:w-auto"
                >
                  <CreditCard className="h-4 w-4" />
                  Pay Now
                  {pendingBills > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {pendingBills}
                    </Badge>
                  )}
                </Button>
              )}
            </div>
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
                            },
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <div>
                          <p className="font-semibold text-lg">
                            ₱{entry.gross_due.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Rent: ₱{entry.rent_due.toLocaleString()} + Charges:{" "}
                            ₱{entry.other_charges.toLocaleString()}
                          </p>
                        </div>
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

      {/* Payment Options Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Options
            </DialogTitle>
            <DialogDescription>
              Choose your preferred payment method
            </DialogDescription>
          </DialogHeader>

          {selectedBilling && (
            <div className="space-y-4">
              {/* Fee Breakdown */}
              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Fee Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Base Rent</span>
                    <span className="font-medium">
                      ₱{selectedBilling.rent_due.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Other Charges</span>
                    <span className="font-medium">
                      ₱{selectedBilling.other_charges.toLocaleString()}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-semibold">Total Amount</span>
                    <span className="font-bold text-lg text-primary">
                      ₱{selectedBilling.gross_due.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    Due Date:{" "}
                    {new Date(selectedBilling.due_date).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      },
                    )}
                  </p>
                </CardContent>
              </Card>

              {/* Digital Payment Methods */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Digital Payment Methods
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-auto flex-col gap-2 py-3"
                    onClick={() => handleDigitalPayment("GCash")}
                  >
                    <Wallet className="h-5 w-5 text-blue-600" />
                    <span className="text-xs">GCash</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto flex-col gap-2 py-3"
                    onClick={() => handleDigitalPayment("PayMaya")}
                  >
                    <Wallet className="h-5 w-5 text-green-600" />
                    <span className="text-xs">PayMaya</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto flex-col gap-2 py-3"
                    onClick={() => handleDigitalPayment("Credit Card")}
                  >
                    <CreditCard className="h-5 w-5 text-purple-600" />
                    <span className="text-xs">Credit Card</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto flex-col gap-2 py-3"
                    onClick={() => handleDigitalPayment("Online Banking")}
                  >
                    <Banknote className="h-5 w-5 text-amber-600" />
                    <span className="text-xs">Bank Transfer</span>
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Traditional Payment Option */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Traditional Payment Methods
                </h4>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Prefer cash or cheque? Notify your landlord to arrange a
                    payment schedule.
                  </AlertDescription>
                </Alert>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleNotifyLandlordTraditional}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Notify Landlord for Cash/Cheque Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Traditional Payment Notification Dialog */}
      <Dialog
        open={isTraditionalPaymentOpen}
        onOpenChange={setIsTraditionalPaymentOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Traditional Payment Notification
            </DialogTitle>
            <DialogDescription>
              Notify landlord about your payment preference
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your landlord will be notified that you prefer to pay via cash
                or advanced cheque. They will contact you to arrange the payment
                details.
              </AlertDescription>
            </Alert>

            <Card className="bg-muted/30">
              <CardContent className="pt-4 space-y-2 text-sm">
                <p className="font-medium">Available traditional methods:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Cash payment (in-person)</li>
                  <li>Post-dated cheques</li>
                  <li>Bank deposit (with deposit slip)</li>
                </ul>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsTraditionalPaymentOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSendTraditionalNotification}
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Notification
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default withTenantAuth(TenantDashboard);
