"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import { Card, CardContent } from "@/components/ui/card";
// import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Building,
  User,
  MapPin,
  Calendar,
  Clock,
  ArrowUpRight,
  Loader2,
  AlertCircle,
  Pencil,
  Phone,
  FileText,
  ClipboardCheck,
  CreditCard,
  Home,
  Archive,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { EditPropertyPopup } from "@/components/edit-property-popup";
import {
  AmenitiesPopup,
  AVAILABLE_AMENITIES,
} from "@/components/amenities-popup";
import { PropertyResetDialog } from "@/components/property-reset-dialog";
import { archiveAndResetProperty } from "@/services/archiveService";
// import { ScrollArea } from "@/components/ui/scroll-area";

// Define TypeScript interfaces for data structures
interface BillingEntry {
  id: string;
  property_id: string;
  tenant_id: string;
  due_date: string;
  rent_due: number;
  other_charges: number; // Keep for data compatibility
  gross_due: number;
  status: string;
  billing_period: number;
  paid_amount?: number;
  created_at: string;
  updated_at: string;
  expense_items?: string; // Add this field for the JSON string of expense items
}

interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
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
  advance_payment?: number;
  security_deposit?: number;
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
  amenities?: string; // JSON string array of amenity IDs
  created_at: string;
  updated_at: string;
  tenants?: Tenant[];
}

interface ActivityLog {
  id: string;
  property_id: string;
  tenant_id: string | null;
  user_id: string | null;
  action_type: string;
  description: string;
  metadata: any;
  created_at: string;
}

interface PropertyDetailsPopupProps {
  propertyId: string;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (propertyId: string) => void;
  onSuccess?: () => void;
}

export function PropertyDetailsPopup({
  propertyId,
  isOpen,
  onClose,
  onEdit,
  onSuccess,
}: PropertyDetailsPopupProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [isEditPopupOpen, setIsEditPopupOpen] = useState(false);
  const [isAmenitiesPopupOpen, setIsAmenitiesPopupOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Wrap fetchPropertyDetails in useCallback to prevent recreation on every render
  const fetchPropertyDetails = useCallback(async () => {
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
        `,
        )
        .eq("id", propertyId)
        .single();

      if (error) throw error;

      setProperty(data as Property);

      // Fetch activity logs for this property
      const { data: logs, error: logsError } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!logsError && logs) {
        setActivityLogs(logs);
      }
    } catch (err) {
      console.error("Error fetching property details:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load property details",
      );
      toast.error("Failed to load property details");
    } finally {
      setLoading(false);
    }
  }, [propertyId, isOpen]);

  useEffect(() => {
    // Call the function in useEffect
    fetchPropertyDetails();
  }, [fetchPropertyDetails]);

  // Enhanced status styling with improved colors and design
  const getStatusColorClass = (status: string): string => {
    const lowerStatus = status.toLowerCase();

    // Good Standing - Green
    if (lowerStatus.includes("collected") || lowerStatus === "good standing") {
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800/50";
    }

    // Needs Monitoring - Orange/Yellow
    if (lowerStatus.includes("delayed") || lowerStatus === "needs monitoring") {
      return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/50";
    }

    // Problem/Urgent - Red
    if (
      lowerStatus.includes("overdue") ||
      lowerStatus.includes("problem") ||
      lowerStatus.includes("urgent")
    ) {
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800/50";
    }

    // Not Yet Due / Upcoming - Blue
    if (
      lowerStatus.includes("not yet due") ||
      lowerStatus.includes("upcoming")
    ) {
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/50";
    }

    // Default / Neutral - Gray
    return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700/50";
  };

  // Convert billing status to payment display status
  const getPaymentDisplayStatus = (status: string): string => {
    const lowerStatus = status.toLowerCase();
    // Good Standing = Paid
    if (lowerStatus === "good standing" || lowerStatus.includes("collected")) {
      return "Paid";
    }
    // All others = Pending
    return "Pending";
  };

  // Get color class for payment display status
  const getPaymentStatusColorClass = (displayStatus: string): string => {
    if (displayStatus === "Paid") {
      return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800/50";
    }
    // Pending
    return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/50";
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return "";

    // Check if it's already formatted (e.g., "Sep 14, 2025")
    if (dateString.includes(",")) {
      return dateString;
    }

    // Handle ISO date string (YYYY-MM-DD)
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split("-").map(Number);
      const date = new Date(year, month - 1, day);

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    // Handle full ISO datetime strings (with T or Z)
    if (dateString.includes("T") || dateString.includes("Z")) {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    // Fallback: try to parse and handle as local date
    const parts = dateString.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts.map(Number);
      const date = new Date(year, month - 1, day);

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }

    // Last resort fallback
    return dateString;
  };

  const formatDueDate = (dateString: string): string => {
    if (!dateString) return "";

    // If already formatted, return as is
    if (dateString.includes(",")) {
      return dateString;
    }

    // Parse the date string manually to avoid timezone conversion
    let year: number, month: number, day: number;

    if (dateString.includes("-")) {
      [year, month, day] = dateString.split("-").map(Number);
    } else if (dateString.includes("/")) {
      const parts = dateString.split("/");
      month = parseInt(parts[0]);
      day = parseInt(parts[1]);
      year = parseInt(parts[2]);
    } else {
      return dateString;
    }

    // Create date in local timezone
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Calculate days until due
  const calculateDaysUntilDue = (dueDate: string): number => {
    // Parse as local date to avoid timezone offset
    const [year, month, day] = dueDate.split("-").map(Number);
    const due = new Date(year, month - 1, day);

    // Get today at midnight local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="sm:max-w-[95%] md:max-w-[90%] lg:max-w-[900px] max-h-[90vh] p-0"
          aria-describedby="loading-description" // This correctly matches the ID below
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Property Details</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
              <p
                id="loading-description"
                className="text-sm text-muted-foreground"
              >
                Loading property details...
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[95%] md:max-w-[90%] lg:max-w-[900px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Error Loading Property
            </DialogTitle>
            <DialogDescription>
              We encountered a problem while loading the property details.
            </DialogDescription>
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

  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  // Recent Transactions: Paid entries (Good Standing) that are past or current
  const recentPayments = billingEntries
    .filter((entry) => {
      const dueDate = new Date(entry.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const isPaid = entry.status === "Good Standing";
      const isPastOrCurrent = dueDate <= currentDate;
      return isPaid && isPastOrCurrent;
    })
    .sort(
      (a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime(),
    )
    .slice(0, 5);

  // Upcoming Payments: Unpaid entries (not Good Standing) that are current or future
  const upcomingPayments = billingEntries
    .filter((entry) => {
      const dueDate = new Date(entry.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const isUnpaid = entry.status !== "Good Standing";
      const isCurrentOrFuture = dueDate >= currentDate;
      return isUnpaid && isCurrentOrFuture;
    })
    .sort(
      (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
    );

  // Calculate financial summaries
  // Total Revenue: All paid entries (Good Standing)
  const totalRevenue = billingEntries
    .filter((entry) => entry.status === "Good Standing")
    .reduce((sum, entry) => sum + entry.gross_due, 0);

  // Pending Payments: All unpaid entries except Problem/Urgent (Needs Monitoring, Neutral/Administrative)
  const pendingPayments = billingEntries
    .filter(
      (entry) =>
        entry.status === "Needs Monitoring" ||
        entry.status === "Neutral / Administrative",
    )
    .reduce((sum, entry) => sum + entry.gross_due, 0);

  // Overdue Amount: Problem/Urgent entries
  const overdueAmount = billingEntries
    .filter((entry) => entry.status === "Problem / Urgent")
    .reduce((sum, entry) => sum + entry.gross_due, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-[95%] md:max-w-[90%] lg:max-w-[900px] p-0 max-h-[95vh] overflow-hidden flex flex-col"
        aria-describedby="property-details-description" // Add this specific ID
      >
        {/* Header - Sticky */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b p-4 md:p-6 pb-3 md:pb-4">
          <DialogHeader className="pb-0">
            <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3">
              <div className="flex items-center">
                <div
                  className={`p-2 rounded-full ${
                    property.occupancy_status === "occupied"
                      ? "bg-green-100 dark:bg-green-900/50"
                      : "bg-amber-100 dark:bg-amber-900/50"
                  } mr-3`}
                >
                  <Building
                    className={`h-5 w-5 md:h-6 md:w-6 ${
                      property.occupancy_status === "occupied"
                        ? "text-green-600 dark:text-green-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  />
                </div>
                <div>
                  <DialogTitle className="text-lg md:text-xl font-bold line-clamp-1">
                    {property.unit_name}
                  </DialogTitle>
                  <DialogDescription
                    id="property-details-description" // Use the same ID as aria-describedby
                    className="flex items-center mt-0.5"
                  >
                    <MapPin className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs md:text-sm text-muted-foreground truncate max-w-[200px] md:max-w-[300px]">
                      {property.property_location}
                    </span>
                  </DialogDescription>
                </div>
              </div>

              {/* Status Badge - Responsive positioning */}
              <Badge
                variant="outline"
                className={`${
                  property.occupancy_status === "occupied"
                    ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800/50"
                    : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/50"
                } px-2 py-1 text-xs capitalize`}
              >
                {property.occupancy_status}
              </Badge>
            </div>
          </DialogHeader>
        </div>

        {/* Tabs - Responsive design */}
        <Tabs
          defaultValue="details"
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="mx-4 md:mx-6 mt-4 grid grid-cols-3 w-auto">
            <TabsTrigger value="details" className="text-xs sm:text-sm">
              Property Details
            </TabsTrigger>
            <TabsTrigger value="finances" className="text-xs sm:text-sm">
              Statement of Account
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">
              Activity Log
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="details"
            className="flex-1 overflow-auto px-4 md:px-6 pt-4 pb-16"
          >
            <div className="space-y-4 md:space-y-6">
              {/* Details tab content... */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <Card className="shadow-sm">
                  <CardContent className="p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                      <Building className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                      Property Information
                    </h3>
                    <div className="space-y-2 md:space-y-3 text-sm">
                      <div className="grid grid-cols-2 items-center">
                        <span className="text-muted-foreground text-xs md:text-sm">
                          Property Type
                        </span>
                        <span className="font-medium text-xs md:text-sm">
                          {property.property_type}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 items-center">
                        <span className="text-muted-foreground text-xs md:text-sm">
                          Monthly Rent
                        </span>
                        <span className="font-medium text-green-600 dark:text-green-400 text-xs md:text-sm">
                          {formatCurrency(property.rent_amount)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 items-center">
                        <span className="text-muted-foreground text-xs md:text-sm">
                          Status
                        </span>
                        <span className="font-medium capitalize text-xs md:text-sm">
                          {property.occupancy_status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 items-center">
                        <span className="text-muted-foreground text-xs md:text-sm">
                          Date Added
                        </span>
                        <span className="font-medium text-xs md:text-sm">
                          {formatDate(property.created_at)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2">
                        <span className="text-muted-foreground text-xs md:text-sm">
                          Location
                        </span>
                        <span className="font-medium break-words text-xs md:text-sm">
                          {property.property_location}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {activeTenant ? (
                  <Card className="shadow-sm">
                    <CardContent className="p-4 md:p-6">
                      <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                        <User className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                        Tenant Information
                      </h3>
                      <div className="space-y-2 md:space-y-3 text-sm">
                        <div className="grid grid-cols-2 items-center">
                          <span className="text-muted-foreground text-xs md:text-sm">
                            Name
                          </span>
                          <span className="font-medium text-xs md:text-sm">
                            {activeTenant.tenant_name}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 items-center">
                          <span className="text-muted-foreground text-xs md:text-sm">
                            Contact Number
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium text-xs md:text-sm">
                              {activeTenant.contact_number}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 items-center">
                          <span className="text-muted-foreground text-xs md:text-sm">
                            Contract Duration
                          </span>
                          <span className="font-medium text-xs md:text-sm">
                            {activeTenant.contract_months} months
                          </span>
                        </div>
                        <div className="grid grid-cols-2 items-center">
                          <span className="text-muted-foreground text-xs md:text-sm">
                            Rent Agreement Date
                          </span>
                          <span className="font-medium text-xs md:text-sm">
                            {formatDate(activeTenant.rent_start_date)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 items-center">
                          <span className="text-muted-foreground text-xs md:text-sm">
                            Due Day
                          </span>
                          <span className="font-medium text-xs md:text-sm">
                            {activeTenant.due_day}
                          </span>
                        </div>
                        {(activeTenant.advance_payment ||
                          activeTenant.security_deposit) && (
                          <>
                            <div className="col-span-2 border-t my-2"></div>
                            {activeTenant.advance_payment !== undefined &&
                              activeTenant.advance_payment > 0 && (
                                <div className="grid grid-cols-2 items-center">
                                  <span className="text-muted-foreground text-xs md:text-sm">
                                    Advance Payment
                                  </span>
                                  <span className="font-medium text-green-600 dark:text-green-400 text-xs md:text-sm">
                                    {formatCurrency(
                                      activeTenant.advance_payment,
                                    )}
                                  </span>
                                </div>
                              )}
                            {activeTenant.security_deposit !== undefined &&
                              activeTenant.security_deposit > 0 && (
                                <div className="grid grid-cols-2 items-center">
                                  <span className="text-muted-foreground text-xs md:text-sm">
                                    Security Deposit
                                  </span>
                                  <span className="font-medium text-green-600 dark:text-green-400 text-xs md:text-sm">
                                    {formatCurrency(
                                      activeTenant.security_deposit,
                                    )}
                                  </span>
                                </div>
                              )}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="shadow-sm">
                    <CardContent className="p-4 md:p-6">
                      <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                        <User className="h-4 w-4 md:h-5 md:w-5 mr-2 text-muted-foreground" />
                        Tenant Information
                      </h3>
                      <div className="flex flex-col items-center justify-center h-24 md:h-32 text-center text-muted-foreground">
                        <Building className="h-6 w-6 md:h-8 md:w-8 mb-2 opacity-40" />
                        <p className="text-xs md:text-sm">
                          This property is currently vacant
                        </p>
                        <p className="text-xs mt-1">
                          Add a tenant once the property is rented
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {property.occupancy_status === "occupied" && activeTenant && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <Card className="shadow-sm">
                    <CardContent className="p-4 md:p-6">
                      <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                        <Calendar className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                        Upcoming Payments
                      </h3>
                      {upcomingPayments.length > 0 ? (
                        <div className="space-y-2 md:space-y-3">
                          {upcomingPayments.slice(0, 3).map((payment) => {
                            const displayStatus = getPaymentDisplayStatus(
                              payment.status,
                            );
                            return (
                              <div
                                key={payment.id}
                                className="flex justify-between items-center p-2 md:p-3 bg-muted/30 rounded-lg border"
                              >
                                <div className="flex items-center">
                                  <Clock className="h-3.5 w-3.5 text-blue-500 mr-1.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs md:text-sm font-medium">
                                      {formatDueDate(payment.due_date)}
                                    </p>
                                    <p className="text-[10px] md:text-xs text-muted-foreground">
                                      Due in{" "}
                                      {calculateDaysUntilDue(payment.due_date)}{" "}
                                      days
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs md:text-sm font-bold block">
                                    {formatCurrency(payment.gross_due)}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] md:text-xs mt-1 ${getPaymentStatusColorClass(
                                      displayStatus,
                                    )}`}
                                  >
                                    {displayStatus}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-20 md:h-24 text-center text-muted-foreground">
                          <p className="text-xs md:text-sm">
                            No upcoming payments
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardContent className="p-4 md:p-6">
                      <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center">
                        Recent Transactions
                      </h3>
                      {recentPayments.length > 0 ? (
                        <div className="space-y-2 md:space-y-3">
                          {recentPayments.slice(0, 3).map((payment) => {
                            // Parse expense items
                            const expenseItems: ExpenseItem[] =
                              payment.expense_items
                                ? JSON.parse(payment.expense_items)
                                : [
                                    {
                                      id: `default-${payment.id}`,
                                      name: "Miscellaneous",
                                      amount: payment.other_charges,
                                    },
                                  ];

                            return (
                              <div
                                key={payment.id}
                                className="flex justify-between items-center p-2 md:p-3 bg-muted/30 rounded-lg border group relative"
                              >
                                <div className="flex items-center">
                                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground mr-1.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-xs md:text-sm font-medium">
                                      {formatDate(payment.due_date)}
                                    </p>
                                    <p className="text-[10px] md:text-xs text-muted-foreground">
                                      Payment #{payment.billing_period}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs md:text-sm font-bold">
                                    {formatCurrency(payment.gross_due)}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`block mt-1 text-[10px] md:text-xs ${getPaymentStatusColorClass(
                                      getPaymentDisplayStatus(payment.status),
                                    )}`}
                                  >
                                    {getPaymentDisplayStatus(payment.status)}
                                  </Badge>

                                  {/* Expense items tooltip - more mobile friendly */}
                                  <div className="hidden group-hover:block absolute right-0 bottom-full mb-2 bg-popover shadow-md rounded-md p-2 z-10 w-48 xs:w-64 border">
                                    <div className="text-xs font-medium mb-1">
                                      Expense Breakdown:
                                    </div>
                                    <div className="flex justify-between text-xs mb-1">
                                      <span>Rent</span>
                                      <span>
                                        {formatCurrency(payment.rent_due)}
                                      </span>
                                    </div>
                                    {expenseItems.map((item) => (
                                      <div
                                        key={item.id}
                                        className="flex justify-between text-xs mb-1"
                                      >
                                        <span className="truncate mr-2">
                                          {item.name}
                                        </span>
                                        <span className="flex-shrink-0">
                                          {formatCurrency(item.amount)}
                                        </span>
                                      </div>
                                    ))}
                                    <div className="border-t pt-1 mt-1 text-xs font-semibold">
                                      <div className="flex justify-between">
                                        <span>Total</span>
                                        <span>
                                          {formatCurrency(payment.gross_due)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-20 md:h-24 text-center text-muted-foreground">
                          <p className="text-xs md:text-sm">
                            No recent transactions
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Amenities Section */}
              <Card className="shadow-sm">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base md:text-lg font-semibold flex items-center">
                      <Home className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                      What this place offers
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAmenitiesPopupOpen(true)}
                      className="text-xs h-8"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Edit
                    </Button>
                  </div>

                  {property &&
                  property.amenities &&
                  JSON.parse(property.amenities).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {JSON.parse(property.amenities).map(
                        (amenityId: string) => {
                          const amenity = AVAILABLE_AMENITIES.find(
                            (a) => a.id === amenityId,
                          );
                          if (!amenity) return null;
                          return (
                            <div
                              key={amenity.id}
                              className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20"
                            >
                              <span className="text-muted-foreground">
                                {amenity.icon}
                              </span>
                              <span className="text-sm">{amenity.name}</span>
                            </div>
                          );
                        },
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                      <Home className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">No amenities added yet</p>
                      <p className="text-xs mt-1">
                        Click Edit to add amenities to this property
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent
            value="finances"
            className="flex-1 overflow-auto px-4 md:px-6 pt-4 pb-16"
          >
            <div className="space-y-4 md:space-y-6">
              {/* Finances tab content... */}
              {property.occupancy_status === "occupied" && activeTenant ? (
                <>
                  {/* Financial Overview - Unified Card */}
                  <Card className="shadow-sm border">
                    <CardContent className="p-4 md:p-6">
                      <h3 className="text-base md:text-lg font-semibold mb-4 flex items-center">
                        Financial Overview
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="p-4 rounded-lg border bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-xs font-medium text-muted-foreground">
                              Total Revenue
                            </h4>
                          </div>
                          <p className="text-lg md:text-xl font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(totalRevenue)}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-3.5 w-3.5 text-blue-500" />
                            <h4 className="text-xs font-medium text-muted-foreground">
                              Pending Payments
                            </h4>
                          </div>
                          <p className="text-lg md:text-xl font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(pendingPayments)}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg border bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                            <h4 className="text-xs font-medium text-muted-foreground">
                              Overdue Amount
                            </h4>
                          </div>
                          <p className="text-lg md:text-xl font-bold text-red-600 dark:text-red-400">
                            {formatCurrency(overdueAmount)}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-xs font-medium text-muted-foreground">
                              Advance Payment
                            </h4>
                          </div>
                          <p className="text-lg md:text-xl font-bold text-emerald-600 dark:text-emerald-400">
                            {activeTenant.advance_payment !== undefined &&
                            activeTenant.advance_payment > 0
                              ? formatCurrency(activeTenant.advance_payment)
                              : formatCurrency(0)}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg border bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-xs font-medium text-muted-foreground">
                              Security Deposit
                            </h4>
                          </div>
                          <p className="text-lg md:text-xl font-bold text-cyan-600 dark:text-cyan-400">
                            {activeTenant.security_deposit !== undefined &&
                            activeTenant.security_deposit > 0
                              ? formatCurrency(activeTenant.security_deposit)
                              : formatCurrency(0)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm">
                    <CardContent className="p-4 md:p-6">
                      <div className="flex justify-between items-center mb-4 md:mb-6">
                        <h3 className="text-base md:text-lg font-semibold flex items-center">
                          <FileText className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                          Billing Table
                        </h3>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8"
                        >
                          Export <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Responsive table with horizontal scrolling for small screens */}
                      <div className="overflow-x-auto -mx-4 sm:-mx-6">
                        <div className="inline-block min-w-full align-middle px-4 sm:px-6">
                          <div className="overflow-hidden border rounded-md">
                            <table className="min-w-full divide-y divide-border">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th
                                    scope="col"
                                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                  >
                                    Period
                                  </th>
                                  <th
                                    scope="col"
                                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                  >
                                    Due Date
                                  </th>
                                  <th
                                    scope="col"
                                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                  >
                                    Rent
                                  </th>
                                  <th
                                    scope="col"
                                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                  >
                                    Expenses
                                  </th>
                                  <th
                                    scope="col"
                                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                  >
                                    Total
                                  </th>
                                  <th
                                    scope="col"
                                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                  >
                                    Paid
                                  </th>
                                  <th
                                    scope="col"
                                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                                  >
                                    Status
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-muted/40 bg-background">
                                {billingEntries.length > 0 ? (
                                  billingEntries
                                    .sort(
                                      (a, b) =>
                                        a.billing_period - b.billing_period,
                                    )
                                    .map((entry) => {
                                      // Parse expense items from JSON string
                                      const expenseItems: ExpenseItem[] =
                                        entry.expense_items
                                          ? JSON.parse(entry.expense_items)
                                          : [
                                              {
                                                id: `default-${entry.id}`,
                                                name: "Miscellaneous",
                                                amount: entry.other_charges,
                                              },
                                            ];

                                      return (
                                        <tr
                                          key={entry.id}
                                          className="hover:bg-muted/30 transition-colors"
                                        >
                                          <td className="px-3 py-2 text-xs whitespace-nowrap">
                                            <div className="flex items-center">
                                              <ClipboardCheck className="h-3 w-3 text-muted-foreground mr-1.5 flex-shrink-0" />
                                              <span>
                                                Month {entry.billing_period}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-xs whitespace-nowrap">
                                            {formatDueDate(entry.due_date)}
                                          </td>
                                          <td className="px-3 py-2 text-xs font-medium text-green-600 dark:text-green-400 whitespace-nowrap">
                                            {formatCurrency(entry.rent_due)}
                                          </td>
                                          <td className="px-3 py-2 text-xs">
                                            <div className="relative group inline-block">
                                              <div className="flex items-center cursor-help gap-1">
                                                <span>
                                                  {formatCurrency(
                                                    entry.other_charges,
                                                  )}
                                                </span>
                                                <span className="text-[10px] bg-muted rounded-full px-1 flex items-center justify-center w-4 h-4">
                                                  {expenseItems.length}
                                                </span>
                                              </div>

                                              {/* Hover tooltip for expenses */}
                                              <div className="hidden group-hover:block absolute left-0 top-full mt-2 bg-popover shadow-lg rounded-md p-2 z-20 min-w-[200px] border">
                                                <div className="text-xs font-medium mb-1.5">
                                                  Expenses for Month{" "}
                                                  {entry.billing_period}:
                                                </div>
                                                {expenseItems.map((item) => (
                                                  <div
                                                    key={item.id}
                                                    className="flex justify-between text-xs mb-1.5"
                                                  >
                                                    <span className="truncate max-w-[150px] pr-4">
                                                      {item.name}
                                                    </span>
                                                    <span className="text-right font-medium">
                                                      {formatCurrency(
                                                        item.amount,
                                                      )}
                                                    </span>
                                                  </div>
                                                ))}
                                                {expenseItems.length > 1 && (
                                                  <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between text-xs font-medium">
                                                    <span>Total Expenses</span>
                                                    <span>
                                                      {formatCurrency(
                                                        entry.other_charges,
                                                      )}
                                                    </span>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-xs font-semibold whitespace-nowrap">
                                            {formatCurrency(entry.gross_due)}
                                          </td>
                                          <td className="px-3 py-2 text-xs font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                                            {formatCurrency(
                                              entry.paid_amount || 0,
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-xs whitespace-nowrap">
                                            <Badge
                                              variant="outline"
                                              className={`text-[10px] px-1.5 py-0.5 ${getStatusColorClass(
                                                entry.status,
                                              )}`}
                                            >
                                              {entry.status}
                                            </Badge>
                                          </td>
                                        </tr>
                                      );
                                    })
                                ) : (
                                  <tr>
                                    <td
                                      colSpan={7}
                                      className="px-3 py-8 text-center"
                                    >
                                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                                        <FileText className="h-8 w-8 mb-2 opacity-40" />
                                        <p className="text-sm font-medium">
                                          No billing entries yet
                                        </p>
                                        <p className="text-xs mt-1">
                                          Click "Edit Property" to add billing
                                          entries
                                        </p>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 md:p-12 text-center">
                  <div className="rounded-full bg-muted/50 p-4 mb-4"></div>
                  <h3 className="text-base md:text-lg font-medium mt-2">
                    No Financial Records
                  </h3>
                  <p className="text-muted-foreground mt-2 max-w-md text-xs md:text-sm">
                    This property is currently vacant. Financial records will be
                    available once a tenant is added to this property.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="history"
            className="flex-1 overflow-auto px-4 md:px-6 pt-4 pb-16"
          >
            <div className="space-y-4">
              <Card className="shadow-sm">
                <CardContent className="p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold mb-4 flex items-center">
                    <Clock className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
                    Activity Timeline
                  </h3>

                  {activityLogs.length > 0 ? (
                    <div className="space-y-3">
                      {activityLogs.map((log, index) => (
                        <div
                          key={log.id}
                          className="flex gap-3 pb-3 border-b last:border-b-0 last:pb-0"
                        >
                          <div className="flex-shrink-0 mt-1">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              {log.action_type.includes("payment") ? (
                                <CreditCard className="h-4 w-4 text-green-600" />
                              ) : log.action_type.includes("tenant") ? (
                                <User className="h-4 w-4 text-blue-600" />
                              ) : log.action_type.includes("property") ? (
                                <Building className="h-4 w-4 text-purple-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">
                              {log.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(log.created_at).toLocaleString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                      <Clock className="h-12 w-12 mb-3 opacity-40" />
                      <p className="text-sm font-medium">No activity yet</p>
                      <p className="text-xs mt-1">
                        Activity history will appear here as changes are made
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Actions - Fixed at bottom */}
        <div className="border-t mt-auto p-4 md:p-6 bg-background/95 backdrop-blur-sm flex justify-between items-center flex-wrap gap-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditPopupOpen(true)}
              className="gap-1.5 h-9 text-xs sm:text-sm"
              size="sm"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Property
            </Button>
            {property.occupancy_status === "occupied" && activeTenant && (
              <Button
                variant="outline"
                onClick={() => setIsResetDialogOpen(true)}
                className="gap-1.5 h-9 text-xs sm:text-sm border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/20"
                size="sm"
              >
                <Archive className="h-3.5 w-3.5" />
                Reset Property
              </Button>
            )}
          </div>

          <Button
            onClick={onClose}
            className="h-9 text-xs sm:text-sm"
            size="sm"
          >
            Close
          </Button>
        </div>
      </DialogContent>

      <AmenitiesPopup
        isOpen={isAmenitiesPopupOpen}
        onClose={() => setIsAmenitiesPopupOpen(false)}
        currentAmenities={
          property?.amenities ? JSON.parse(property.amenities) : []
        }
        onSave={async (selectedAmenities) => {
          try {
            const { error } = await supabase
              .from("properties")
              .update({ amenities: JSON.stringify(selectedAmenities) })
              .eq("id", propertyId);

            if (error) throw error;

            // Refresh property data
            await fetchPropertyDetails();
            toast.success("Amenities updated successfully");
          } catch (err) {
            console.error("Error updating amenities:", err);
            toast.error(
              "Failed to update amenities. The amenities column may not exist in the database yet.",
            );
          }
        }}
      />

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

      <PropertyResetDialog
        isOpen={isResetDialogOpen}
        onClose={() => setIsResetDialogOpen(false)}
        onConfirm={async (remarks) => {
          if (!activeTenant) {
            toast.error("No active tenant found");
            return;
          }

          const result = await archiveAndResetProperty({
            propertyId: propertyId,
            tenantId: activeTenant.id,
            remarks: remarks,
          });

          if (result.success) {
            toast.success("Property reset successfully");
            setIsResetDialogOpen(false);
            onClose(); // Close the details popup
            // Refresh the parent component data
            if (onSuccess) {
              onSuccess();
            }
          } else {
            toast.error(result.error || "Failed to reset property");
          }
        }}
        propertyName={property.unit_name}
        tenantName={activeTenant?.tenant_name || ""}
      />
    </Dialog>
  );
}
