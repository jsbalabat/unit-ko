"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
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
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building,
  User,
  Calendar,
  // Clock,
  Loader2,
  AlertCircle,
  Save,
  Lock,
  Unlock,
  DollarSign,
  ArrowRightLeft,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

// Define types
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
  paid_amount?: number;
  expense_items?: string; // Add this field for the JSON string
  created_at: string;
  updated_at: string;
}

interface Tenant {
  id: string;
  property_id: string;
  tenant_name: string;
  contact_number: string;
  pax?: number;
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

// Form data interface
interface PropertyFormData {
  id: string;
  unitName: string;
  propertyType: string;
  propertyLocation: string;
  occupancyStatus: "occupied" | "vacant";
  rentAmount: number;
  tenantId?: string;
  tenantName: string;
  contactNumber: string;
  pax: number;
  contractMonths: number;
  rentStartDate: string;
  dueDay: string;
  billingSchedule: Array<{
    id: string;
    dueDate: string;
    rentDue: number;
    otherCharges: number;
    grossDue: number;
    status: string;
    paidAmount?: number;
  }>;
}

interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
}

interface EditPropertyPopupProps {
  propertyId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSwitchToBilling?: () => void;
}

export function EditPropertyPopup({
  propertyId,
  isOpen,
  onClose,
  onSuccess,
  onSwitchToBilling,
}: EditPropertyPopupProps) {
  const [loading, setLoading] = useState(true);
  const [isSwitchConfirmOpen, setIsSwitchConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [formData, setFormData] = useState<PropertyFormData | null>(null);
  const [isLocked, setIsLocked] = useState(true);

  // Fetch property data when the popup opens
  useEffect(() => {
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
          `,
          )
          .eq("id", propertyId)
          .single();

        if (error) throw error;

        const propertyData = data as Property;
        setProperty(propertyData);

        // Find the active tenant
        const activeTenant = propertyData.tenants?.find((t) => t.is_active);

        // Prepare form data
        const initialFormData: PropertyFormData = {
          id: propertyData.id,
          unitName: propertyData.unit_name,
          propertyType: propertyData.property_type,
          propertyLocation: propertyData.property_location,
          occupancyStatus: propertyData.occupancy_status,
          rentAmount: propertyData.rent_amount,
          tenantId: activeTenant?.id,
          tenantName: activeTenant?.tenant_name || "",
          contactNumber: activeTenant?.contact_number || "",
          pax: activeTenant?.pax || 1,
          contractMonths: activeTenant?.contract_months || 0,
          rentStartDate: activeTenant?.rent_start_date || "",
          dueDay: activeTenant?.due_day || "30th/31st - Last Day",
          billingSchedule: [],
        };

        // Add billing entries if tenant exists
        if (
          activeTenant?.billing_entries &&
          activeTenant.billing_entries.length > 0
        ) {
          initialFormData.billingSchedule = activeTenant.billing_entries.map(
            (entry) => ({
              id: entry.id,
              dueDate: entry.due_date,
              rentDue: entry.rent_due,
              otherCharges: entry.other_charges,
              grossDue: entry.gross_due,
              status: entry.status,
              paidAmount: entry.paid_amount || 0,
            }),
          );

          // Initialize expense items for each billing entry
          const initialExpenseItems: Record<string, ExpenseItem[]> = {};
        }

        // After preparing the initial form data
        if (initialFormData.billingSchedule.length > 0) {
          // Ensure all billing entries use the property's rent amount
          const updatedSchedule = initialFormData.billingSchedule.map(
            (entry) => {
              // Keep other charges as is
              const otherCharges = entry.otherCharges;

              // Update rent amount to match property's rent amount
              const updatedRentDue = initialFormData.rentAmount;

              // Recalculate gross amount
              const updatedGrossDue = updatedRentDue + otherCharges;

              return {
                ...entry,
                rentDue: updatedRentDue,
                grossDue: updatedGrossDue,
              };
            },
          );

          initialFormData.billingSchedule = updatedSchedule;
        }

        // Also handle due dates if needed
        if (
          initialFormData.billingSchedule.length > 0 &&
          initialFormData.dueDay
        ) {
          // Recalculate all dates to match the due day setting
          const rentStartDate = initialFormData.rentStartDate
            ? new Date(initialFormData.rentStartDate)
            : new Date();

          const updatedSchedule = initialFormData.billingSchedule.map(
            (entry, index) => {
              // Calculate the month for this billing entry
              const entryMonth = new Date(rentStartDate);
              entryMonth.setMonth(rentStartDate.getMonth() + index);

              // Apply the due day rule
              const dueDate = calculateDueDate(
                entryMonth,
                initialFormData.dueDay,
              );

              return {
                ...entry,
                dueDate: formatDueDate(dueDate),
              };
            },
          );

          initialFormData.billingSchedule = updatedSchedule;
        }

        setFormData(initialFormData);
      } catch (err) {
        console.error("Error fetching property details:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load property details",
        );
        toast.error("Failed to load property details");
      } finally {
        setLoading(false);
      }
    };

    fetchPropertyDetails();
  }, [propertyId, isOpen]);

  // Add this helper function to calculate the proper due date based on dueDay setting
  const calculateDueDate = (baseDate: Date, dueDay: string): Date => {
    const month = baseDate.getMonth();
    const result = new Date(baseDate);

    // Handle new numeric format (1-31) and special values
    if (dueDay === "last" || dueDay === "30th/31st - Last Day") {
      // Set to last day of month
      result.setMonth(month + 1, 0);
    } else if (dueDay === "1" || dueDay === "1st - First Day") {
      result.setDate(1);
    } else if (dueDay === "15" || dueDay === "15th - Mid Month") {
      result.setDate(15);
    } else {
      // Handle custom numeric day (1-31)
      const dayNumber = parseInt(dueDay);
      if (!isNaN(dayNumber) && dayNumber >= 1 && dayNumber <= 31) {
        const lastDayOfMonth = new Date(
          result.getFullYear(),
          month + 1,
          0,
        ).getDate();
        // Set to the specified day, or last day if the month doesn't have that many days
        result.setDate(Math.min(dayNumber, lastDayOfMonth));
      } else {
        // Default to last day if format is unrecognized
        result.setMonth(month + 1, 0);
      }
    }

    return result;
  };

  const formatDueDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleChange = (
    field: keyof PropertyFormData,
    value: string | number | boolean | Date,
  ) => {
    if (!formData) return;

    // Create a copy of the form data
    const updatedFormData = { ...formData, [field]: value };

    if (field === "rentAmount" && formData.billingSchedule.length > 0) {
      // Convert to number safely depending on the type
      const newRentAmount =
        typeof value === "number" ? value : parseFloat(value as string) || 0;
      const currentDate = new Date();

      const updatedSchedule = formData.billingSchedule.map((entry) => {
        // Parse the due date to determine if this is a future payment
        const dueDate = new Date(entry.dueDate);
        const isPastPayment = dueDate < currentDate;

        // Only update current and future payments
        if (!isPastPayment) {
          const otherCharges = entry.otherCharges;
          const newGrossAmount = newRentAmount + otherCharges;

          return {
            ...entry,
            rentDue: newRentAmount,
            grossDue: newGrossAmount,
          };
        }

        return entry;
      });

      updatedFormData.billingSchedule = updatedSchedule;

      const updatedCount = updatedSchedule.filter(
        (entry) => new Date(entry.dueDate) >= currentDate,
      ).length;

      toast.success("Rent amount updated", {
        description: `Updated rent for ${updatedCount} upcoming payment${
          updatedCount !== 1 ? "s" : ""
        }. Past payments were not affected.`,
      });
    } else if (field === "dueDay" && formData.billingSchedule.length > 0) {
      // When due day changes, update all billing dates
      const updatedSchedule = formData.billingSchedule.map((entry) => {
        const currentDate = new Date(entry.dueDate);

        const firstEntryDate = new Date(formData.billingSchedule[0].dueDate);
        const monthDiff =
          (currentDate.getFullYear() - firstEntryDate.getFullYear()) * 12 +
          (currentDate.getMonth() - firstEntryDate.getMonth());

        const baseDate = formData.rentStartDate
          ? new Date(formData.rentStartDate)
          : new Date();

        baseDate.setMonth(baseDate.getMonth() + monthDiff);

        const newDueDate = calculateDueDate(baseDate, value as string);

        return {
          ...entry,
          dueDate: formatDueDate(newDueDate),
        };
      });

      updatedFormData.billingSchedule = updatedSchedule;

      toast.success("Payment dates updated", {
        description:
          "All billing dates have been adjusted to match the new payment schedule",
      });
    }

    // Set the updated form data
    setFormData(updatedFormData);
  };

  // Submit the form
  const handleSubmit = async () => {
    if (!formData) return;

    setSubmitting(true);
    setError(null);

    try {
      // Update property info
      const { error: propertyError } = await supabase
        .from("properties")
        .update({
          unit_name: formData.unitName,
          property_type: formData.propertyType,
          property_location: formData.propertyLocation,
          rent_amount: formData.rentAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", formData.id);

      if (propertyError) throw propertyError;

      // Update tenant info if applicable
      if (formData.occupancyStatus === "occupied" && formData.tenantId) {
        const { error: tenantError } = await supabase
          .from("tenants")
          .update({
            contact_number: formData.contactNumber,
            rent_start_date: formData.rentStartDate,
            due_day: formData.dueDay,
            pax: formData.pax,
            updated_at: new Date().toISOString(),
          })
          .eq("id", formData.tenantId);

        if (tenantError) throw tenantError;

        // Handle billing entries
        for (const entry of formData.billingSchedule) {
          // For existing entries, update them
          if (!entry.id.startsWith("temp-")) {
            const { error: billingError } = await supabase
              .from("billing_entries")
              .update({
                due_date: entry.dueDate,
                status: entry.status,
                other_charges: entry.otherCharges,
                rent_due: entry.rentDue,
                gross_due: entry.grossDue,
                paid_amount: entry.paidAmount || 0,
                updated_at: new Date().toISOString(),
              })
              .eq("id", entry.id);

            if (billingError) throw billingError;
          }
          // For new entries, insert them
          else {
            const { error: newBillingError } = await supabase
              .from("billing_entries")
              .insert({
                property_id: formData.id,
                tenant_id: formData.tenantId,
                due_date: entry.dueDate,
                rent_due: entry.rentDue,
                other_charges: entry.otherCharges,
                gross_due: entry.grossDue,
                status: entry.status,
                paid_amount: entry.paidAmount || 0,
                billing_period: formData.billingSchedule.indexOf(entry) + 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });

            if (newBillingError) throw newBillingError;
          }
        }
      }

      // Track deleted entries that need to be removed from database
      const currentEntryIds = formData.billingSchedule.map((entry) => entry.id);
      const originalEntryIds =
        property?.tenants
          ?.find((t) => t.is_active)
          ?.billing_entries?.map((be) => be.id) || [];

      // Find entries that exist in original data but not in current form data (they were deleted)
      const deletedEntryIds = originalEntryIds.filter(
        (id) => !currentEntryIds.includes(id),
      );

      // Handle deleted entries if any
      if (deletedEntryIds.length > 0) {
        for (const deletedId of deletedEntryIds) {
          const { error: deleteError } = await supabase
            .from("billing_entries")
            .delete()
            .eq("id", deletedId);

          if (deleteError) throw deleteError;
        }
      }

      toast.success("Property updated successfully", {
        description: `${formData.unitName} has been updated.`,
      });

      // Call the success callback if provided
      if (onSuccess) onSuccess();

      // Close the dialog AFTER all operations are successful
      onClose();
    } catch (err) {
      console.error("Error updating property:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update property",
      );
      toast.error("Failed to update property");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="sr-only">Loading Property</DialogTitle>
            <DialogDescription>Loading Property</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-lg">Loading property data...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error && !formData) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[900px] [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="sr-only">
              Error Loading Property
            </DialogTitle>
            <DialogDescription>Error Loading Property</DialogDescription>
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

  if (!formData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-[95%] md:max-w-[85%] lg:max-w-[900px] w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6 [&>button]:hidden"
        aria-describedby="dialog-description"
      >
        <DialogHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-2 sm:pt-5 space-y-2 sm:space-y-0">
          <div>
            <DialogTitle className="text-lg sm:text-xl flex items-center">
              <Building className="mr-2 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              <span className="truncate">
                Edit Property: {formData.unitName}
              </span>
            </DialogTitle>
            <DialogDescription
              id="dialog-description"
              className="text-xs sm:text-sm"
            >
              Update property information, tenant details, and payment statuses.
            </DialogDescription>
          </div>

          {/* Action buttons and Lock toggle - responsive layout */}
          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {/* Switch to Edit Billing Button */}
            {formData.occupancyStatus === "occupied" &&
              formData.tenantId &&
              onSwitchToBilling && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSwitchConfirmOpen(true)}
                  className="text-xs h-8 gap-1.5"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Edit Billing</span>
                </Button>
              )}

            {/* Cancel Button */}
            <Button
              variant="outline"
              onClick={onClose}
              className="text-xs h-8"
              size="sm"
            >
              Cancel
            </Button>

            {/* Save Changes Button */}
            <Button
              onClick={handleSubmit}
              disabled={submitting || isLocked}
              className={`gap-1.5 text-xs h-8 ${
                isLocked ? "opacity-50 cursor-not-allowed" : ""
              }`}
              size="sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save
                </>
              )}
            </Button>

            {/* Lock toggle */}
            <div className="flex items-center space-x-1 mr-1">
              {isLocked ? (
                <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              ) : (
                <Unlock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
              )}
              <span className="text-xs sm:text-sm font-medium hidden sm:inline">
                {isLocked ? "Locked" : "Unlocked"}
              </span>
            </div>
            <Switch
              checked={!isLocked}
              onCheckedChange={(checked) => setIsLocked(!checked)}
            />
          </div>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-8">
          {/* Property Details Section */}
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <Building className="mr-2 h-4 w-4" />
              Property Details
            </h2>
            <Card>
              <CardContent className="p-3 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unitName">Unit Name</Label>
                    <Input
                      id="unitName"
                      value={formData.unitName}
                      onChange={(e) => handleChange("unitName", e.target.value)}
                      disabled={isLocked}
                      className={isLocked ? "opacity-70" : ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="propertyType">Property Type</Label>
                    <Select
                      value={formData.propertyType}
                      onValueChange={(value) =>
                        handleChange("propertyType", value)
                      }
                      disabled={isLocked}
                    >
                      <SelectTrigger className={isLocked ? "opacity-70" : ""}>
                        <SelectValue placeholder="Select property type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Residential - Apartment">
                          Residential - Apartment
                        </SelectItem>
                        <SelectItem value="Residential - House">
                          Residential - House
                        </SelectItem>
                        <SelectItem value="Commercial - Office">
                          Commercial - Office
                        </SelectItem>
                        <SelectItem value="Commercial - Retail">
                          Commercial - Retail
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rentAmount">Monthly Rent Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5">₱</span>
                      <Input
                        id="rentAmount"
                        type="number"
                        className={`pl-7 ${isLocked ? "opacity-70" : ""}`}
                        value={formData.rentAmount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/^0+(?=\d)/, "");
                          handleChange("rentAmount", parseFloat(value) || 0);
                        }}
                        disabled={isLocked}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="propertyLocation">Address</Label>
                    <Input
                      id="propertyLocation"
                      value={formData.propertyLocation}
                      onChange={(e) =>
                        handleChange("propertyLocation", e.target.value)
                      }
                      disabled={isLocked}
                      className={isLocked ? "opacity-70" : ""}
                      placeholder="Enter property address"
                    />
                  </div>

                  <div className="space-y-2 bg-muted/20 p-3 rounded-md">
                    <p className="text-xs text-muted-foreground">
                      Property ID: {formData.id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Occupancy Status: {formData.occupancyStatus}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Tenant Info Section */}
          {formData.occupancyStatus === "occupied" && (
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <User className="mr-2 h-4 w-4" />
                Tenant Information
              </h2>
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tenantName">
                        Tenant Name (Read Only)
                      </Label>
                      <Input
                        id="tenantName"
                        value={formData.tenantName}
                        disabled
                      />
                      <p className="text-xs text-muted-foreground">
                        Tenant name cannot be changed in edit mode
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contactNumber">Contact Number</Label>
                      <Input
                        id="contactNumber"
                        value={formData.contactNumber}
                        onChange={(e) =>
                          handleChange("contactNumber", e.target.value)
                        }
                        disabled={isLocked}
                        className={isLocked ? "opacity-70" : ""}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="pax"
                        className="flex items-center gap-1.5"
                      >
                        <User className="h-3.5 w-3.5" />
                        Number of Pax (Bed Space)
                      </Label>
                      <Input
                        id="pax"
                        type="number"
                        min="1"
                        max="20"
                        value={formData.pax}
                        onChange={(e) => {
                          const value = e.target.value.replace(/^0+(?=\d)/, "");
                          handleChange("pax", parseInt(value) || 1);
                        }}
                        disabled={isLocked}
                        className={isLocked ? "opacity-70" : ""}
                      />
                      <p className="text-xs text-muted-foreground">
                        Number of persons sharing this unit
                      </p>
                      {formData.pax >= 1 &&
                        property &&
                        property.rent_amount && (
                          <div className="mt-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                            <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                              Per-Person Rent: ₱
                              {(
                                property.rent_amount / formData.pax
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                            <p className="text-[10px] text-blue-700 dark:text-blue-300 mt-0.5">
                              Total ₱{property.rent_amount.toLocaleString()} ÷{" "}
                              {formData.pax} persons
                            </p>
                          </div>
                        )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rentStartDate">
                        {" "}
                        Rent Agreement Date
                      </Label>
                      <Input
                        id="rentStartDate"
                        type="date"
                        value={formData.rentStartDate}
                        onChange={(e) =>
                          handleChange("rentStartDate", e.target.value)
                        }
                        disabled={isLocked}
                        className={isLocked ? "opacity-70" : ""}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label
                        htmlFor="dueDay"
                        className="text-sm font-medium flex items-center gap-1.5"
                      >
                        <Calendar className="h-3.5 w-3.5 text-purple-600" />
                        Payment Due Day of Month
                      </Label>

                      {/* Quick Selection Buttons */}
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <Button
                          type="button"
                          variant={
                            formData.dueDay === "1" ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => handleChange("dueDay", "1")}
                          disabled={isLocked}
                          className="h-8 text-xs"
                        >
                          1st - First Day
                        </Button>
                        <Button
                          type="button"
                          variant={
                            formData.dueDay === "15" ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => handleChange("dueDay", "15")}
                          disabled={isLocked}
                          className="h-8 text-xs"
                        >
                          15th - Mid Month
                        </Button>
                        <Button
                          type="button"
                          variant={
                            formData.dueDay === "last" ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => handleChange("dueDay", "last")}
                          disabled={isLocked}
                          className="h-8 text-xs"
                        >
                          Last Day
                        </Button>
                      </div>

                      {/* Custom Day Input */}
                      <div className="flex items-center gap-2">
                        <Input
                          id="dueDay"
                          type="number"
                          value={
                            formData.dueDay === "last" ? "" : formData.dueDay
                          }
                          onChange={(e) => {
                            let value = e.target.value.replace(/^0+(?=\d)/, "");
                            if (
                              value === "" ||
                              (parseInt(value) >= 1 && parseInt(value) <= 31)
                            ) {
                              handleChange("dueDay", value);
                            }
                          }}
                          placeholder="Or enter custom day (1-31)"
                          min="1"
                          max="31"
                          className="h-9 text-sm flex-1"
                          disabled={isLocked || formData.dueDay === "last"}
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          day of month
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Select a preset or enter a custom day (1-31). Note: Day
                        31 will adjust to last day for shorter months.
                      </p>
                    </div>
                  </div>

                  <Alert className="bg-amber-50 text-amber-800 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription>
                      Changing these details won&apos;t automatically update
                      existing billing schedules. You&apos;ll need to update
                      payment statuses individually.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </section>
          )}

          {formData.occupancyStatus === "vacant" && (
            <Alert className="bg-blue-50 text-blue-800 border-blue-200">
              <User className="h-4 w-4 text-blue-600" />
              <AlertDescription>
                This property is currently vacant. Some editing options are
                limited until a tenant is assigned.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator className="my-4 sm:my-6" />
      </DialogContent>

      {/* Switch Confirmation Dialog */}
      <AlertDialog
        open={isSwitchConfirmOpen}
        onOpenChange={setIsSwitchConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to Edit Billing?</AlertDialogTitle>
            <AlertDialogDescription>
              Any unsaved changes will be lost. Are you sure you want to switch
              to Edit Billing?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsSwitchConfirmOpen(false);
                onClose(); // Close current dialog without saving
                onSwitchToBilling?.(); // Open billing dialog
              }}
            >
              Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
