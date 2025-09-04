"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  User,
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  ArrowUpRight,
  Loader2,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { EditPropertyPopup } from "@/components/edit-property-popup";

// Define TypeScript interfaces for data structures
interface BillingEntry {
  id: string;
  property_id: string;
  tenant_id: string;
  due_date: string;
  rent_due: number;
  other_charges: number;
  gross_due: number;
  status: string;
  billing_period: number;
  created_at: string;
  updated_at: string;
}

interface Tenant {
  id: string;
  property_id: string;
  tenant_name: string;
  contact_number: string;
  contract_months: number;
  rent_start_date: string;
  due_day: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  billing_entries?: BillingEntry[];
}

interface Property {
  id: string;
  unit_name: string;
  property_type: string;
  occupancy_status: "occupied" | "vacant";
  property_location: string;
  rent_amount: number;
  created_at: string;
  updated_at: string;
  tenants?: Tenant[];
}

interface PropertyDetailsPopupProps {
  propertyId: string;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (propertyId: string) => void;
}

export function PropertyDetailsPopup({
  propertyId,
  isOpen,
  onClose,
  onEdit,
}: PropertyDetailsPopupProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);

  // Move fetchPropertyDetails outside useEffect so it can be called elsewhere
  const fetchPropertyDetails = async () => {
    if (!isOpen || !propertyId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("properties")
        .select(
          `
          *,
          tenants (
            *,
            billing_entries(*)
          )
        `
        )
        .eq("id", propertyId)
        .single();

      if (error) throw error;

      setProperty(data as Property);
    } catch (err) {
      console.error("Error fetching property details:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load property details"
      );
      toast.error("Failed to load property details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Call the function in useEffect
    fetchPropertyDetails();
  }, [propertyId, isOpen]);

  const getStatusColorClass = (status: string): string => {
    switch (status.toLowerCase()) {
      case "collected - cash":
      case "collected - cheque":
      case "collected - bank transfer":
        return "bg-green-100 text-green-800 border-green-200";
      case "delayed":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "overdue":
        return "bg-red-100 text-red-800 border-red-200";
      case "not yet due":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Calculate days until due
  const calculateDaysUntilDue = (dueDate: string): number => {
    return Math.ceil(
      (new Date(dueDate).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24)
    );
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">
              Loading Property Details
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-lg">Loading property details...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle className="sr-only">
              Error Loading Property
            </DialogTitle>
          </DialogHeader>
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!property) return null;

  const activeTenant = property.tenants?.find((t) => t.is_active);
  const billingEntries = activeTenant?.billing_entries || [];
  const upcomingPayments = billingEntries
    .filter((entry) => entry.status === "Not Yet Due")
    .sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );
  const recentPayments = billingEntries
    .filter(
      (entry) =>
        entry.status.includes("Collected") || entry.status === "Delayed"
    )
    .sort(
      (a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
    )
    .slice(0, 5);

  // Calculate financial summaries
  const totalRevenue = billingEntries
    .filter((entry) => entry.status.includes("Collected"))
    .reduce((sum, entry) => sum + entry.gross_due, 0);

  const pendingPayments = billingEntries
    .filter((entry) => entry.status === "Not Yet Due")
    .reduce((sum, entry) => sum + entry.gross_due, 0);

  const overdueAmount = billingEntries
    .filter((entry) => entry.status === "Overdue" || entry.status === "Delayed")
    .reduce((sum, entry) => sum + entry.gross_due, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div
                className={`p-2 rounded-full ${
                  property.occupancy_status === "occupied"
                    ? "bg-green-100"
                    : "bg-yellow-100"
                } mr-3`}
              >
                <Building
                  className={`h-6 w-6 ${
                    property.occupancy_status === "occupied"
                      ? "text-green-600"
                      : "text-yellow-600"
                  }`}
                />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  {property.unit_name}
                </DialogTitle>
                <DialogDescription className="flex items-center mt-1">
                  <MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {property.property_location}
                  </span>
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          defaultValue="details"
          value={activeTab}
          onValueChange={setActiveTab}
          className="mt-4"
        >
          <TabsList className="grid grid-cols-2 mb-6">
            <TabsTrigger value="details">Property Details</TabsTrigger>
            <TabsTrigger value="finances">Financial Records</TabsTrigger>
            {/* <TabsTrigger value="documents">Documents</TabsTrigger> */}
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <Building className="h-5 w-5 mr-2 text-primary" />
                    Property Information
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2">
                      <span className="text-muted-foreground">
                        Property Type:
                      </span>
                      <span className="font-medium">
                        {property.property_type}
                      </span>
                    </div>
                    <div className="grid grid-cols-2">
                      <span className="text-muted-foreground">
                        Monthly Rent:
                      </span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(property.rent_amount)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-medium capitalize">
                        {property.occupancy_status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2">
                      <span className="text-muted-foreground">Date Added:</span>
                      <span className="font-medium">
                        {formatDate(property.created_at)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2">
                      <span className="text-muted-foreground">Location:</span>
                      <span className="font-medium break-words">
                        {property.property_location}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {activeTenant ? (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <User className="h-5 w-5 mr-2 text-primary" />
                      Tenant Information
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-2">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">
                          {activeTenant.tenant_name}
                        </span>
                      </div>
                      <div className="grid grid-cols-2">
                        <span className="text-muted-foreground">
                          Contact Number:
                        </span>
                        <span className="font-medium">
                          {activeTenant.contact_number}
                        </span>
                      </div>
                      <div className="grid grid-cols-2">
                        <span className="text-muted-foreground">
                          Contract Duration:
                        </span>
                        <span className="font-medium">
                          {activeTenant.contract_months} months
                        </span>
                      </div>
                      <div className="grid grid-cols-2">
                        <span className="text-muted-foreground">
                          Start Date:
                        </span>
                        <span className="font-medium">
                          {formatDate(activeTenant.rent_start_date)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2">
                        <span className="text-muted-foreground">Due Day:</span>
                        <span className="font-medium">
                          {activeTenant.due_day}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <User className="h-5 w-5 mr-2 text-muted" />
                      Tenant Information
                    </h3>
                    <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground">
                      <Building className="h-8 w-8 mb-2 opacity-40" />
                      <p>This property is currently vacant</p>
                      <p className="text-sm mt-1">
                        Add a tenant once the property is rented
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {property.occupancy_status === "occupied" && activeTenant && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-primary" />
                      Upcoming Payments
                    </h3>
                    {upcomingPayments.length > 0 ? (
                      <div className="space-y-3">
                        {upcomingPayments.slice(0, 3).map((payment) => (
                          <div
                            key={payment.id}
                            className="flex justify-between items-center p-3 bg-background rounded-lg border"
                          >
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 text-blue-500 mr-2" />
                              <div>
                                <p className="text-sm font-medium">
                                  {formatDate(payment.due_date)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Due in{" "}
                                  {calculateDaysUntilDue(payment.due_date)} days
                                </p>
                              </div>
                            </div>
                            <span className="text-sm font-bold">
                              {formatCurrency(payment.gross_due)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-24 text-center text-muted-foreground">
                        <p>No upcoming payments</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                      <DollarSign className="h-5 w-5 mr-2 text-primary" />
                      Recent Transactions
                    </h3>
                    {recentPayments.length > 0 ? (
                      <div className="space-y-3">
                        {recentPayments.slice(0, 3).map((payment) => (
                          <div
                            key={payment.id}
                            className="flex justify-between items-center p-3 bg-background rounded-lg border"
                          >
                            <div className="flex items-center">
                              <div>
                                <p className="text-sm font-medium">
                                  {formatDate(payment.due_date)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Payment #{payment.billing_period}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold">
                                {formatCurrency(payment.gross_due)}
                              </span>
                              <Badge
                                variant="outline"
                                className={`block mt-1 text-xs ${getStatusColorClass(
                                  payment.status
                                )}`}
                              >
                                {payment.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-24 text-center text-muted-foreground">
                        <p>No recent transactions</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Finances Tab */}
          <TabsContent value="finances" className="space-y-6">
            {property.occupancy_status === "occupied" && activeTenant ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Total Revenue
                      </h3>
                      <p className="text-2xl font-bold text-green-600 mt-2">
                        {formatCurrency(totalRevenue)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Pending Payments
                      </h3>
                      <p className="text-2xl font-bold text-blue-600 mt-2">
                        {formatCurrency(pendingPayments)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Overdue Amount
                      </h3>
                      <p className="text-2xl font-bold text-red-600 mt-2">
                        {formatCurrency(overdueAmount)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-semibold">
                        Complete Payment History
                      </h3>
                      <Button size="sm" variant="outline">
                        Export <ArrowUpRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="text-left border-b">
                            <th className="pb-2 font-medium">Billing Period</th>
                            <th className="pb-2 font-medium">Due Date</th>
                            <th className="pb-2 font-medium">Rent Amount</th>
                            <th className="pb-2 font-medium">Other Charges</th>
                            <th className="pb-2 font-medium">Total Due</th>
                            <th className="pb-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {billingEntries
                            .sort((a, b) => a.billing_period - b.billing_period)
                            .map((entry) => (
                              <tr
                                key={entry.id}
                                className="border-b border-muted hover:bg-muted/50"
                              >
                                <td className="py-3 text-sm">
                                  Month {entry.billing_period}
                                </td>
                                <td className="py-3 text-sm">
                                  {formatDate(entry.due_date)}
                                </td>
                                <td className="py-3 text-sm">
                                  {formatCurrency(entry.rent_due)}
                                </td>
                                <td className="py-3 text-sm">
                                  {formatCurrency(entry.other_charges)}
                                </td>
                                <td className="py-3 text-sm font-medium">
                                  {formatCurrency(entry.gross_due)}
                                </td>
                                <td className="py-3 text-sm">
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${getStatusColorClass(
                                      entry.status
                                    )}`}
                                  >
                                    {entry.status}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <DollarSign className="h-12 w-12 text-muted-foreground opacity-40" />
                <h3 className="text-lg font-medium mt-4">
                  No Financial Records
                </h3>
                <p className="text-muted-foreground mt-2 max-w-md">
                  This property is currently vacant. Financial records will be
                  available once a tenant is added to this property.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6">
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground opacity-40"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <h3 className="text-lg font-medium mt-4">No Documents Found</h3>
              <p className="text-muted-foreground mt-2">
                Upload lease agreements, contracts, and other important
                documents for this property.
              </p>
              <Button className="mt-4">Upload Document</Button>
            </div>
          </TabsContent>
        </Tabs>

        <Separator className="my-6" />

        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => setIsEditPopupOpen(true)}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            Edit Property
          </Button>
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>

      {isEditPopupOpen && (
        <EditPropertyPopup
          propertyId={propertyId}
          isOpen={isEditPopupOpen}
          onClose={() => setIsEditPopupOpen(false)}
          onSuccess={() => {
            // Refresh data when edit is successful
            if (onEdit) {
              onEdit(propertyId);
            }
            // Now this call will work properly
            fetchPropertyDetails();
          }}
        />
      )}
    </Dialog>
  );
}
