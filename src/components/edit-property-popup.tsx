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
  // DollarSign,
  // Clock,
  Loader2,
  AlertCircle,
  Save,
  Lock,
  Unlock,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { OtherChargesPopup } from "@/components/other-charges-popup";
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
  expense_items?: string; // Add this field for the JSON string
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

// Form data interface
interface PropertyFormData {
  id: string;
  unitName: string;
  propertyType: string;
  occupancyStatus: "occupied" | "vacant";
  rentAmount: number;
  tenantId?: string;
  tenantName: string;
  contactNumber: string;
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
}

export function EditPropertyPopup({
  propertyId,
  isOpen,
  onClose,
  onSuccess,
}: EditPropertyPopupProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [formData, setFormData] = useState<PropertyFormData | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isOtherChargesPopupOpen, setIsOtherChargesPopupOpen] = useState(false);
  const [selectedBillingIndex, setSelectedBillingIndex] = useState<
    number | null
  >(null);
  const [expenseItemsByBillingId, setExpenseItemsByBillingId] = useState<
    Record<string, ExpenseItem[]>
  >({});
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
          `
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
          occupancyStatus: propertyData.occupancy_status,
          rentAmount: propertyData.rent_amount,
          tenantId: activeTenant?.id,
          tenantName: activeTenant?.tenant_name || "",
          contactNumber: activeTenant?.contact_number || "",
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
            })
          );

          // Initialize expense items for each billing entry
          const initialExpenseItems: Record<string, ExpenseItem[]> = {};

          activeTenant.billing_entries.forEach((entry) => {
            if (entry.expense_items) {
              try {
                // Parse expense items from JSON string
                const items = JSON.parse(entry.expense_items) as ExpenseItem[];
                if (Array.isArray(items) && items.length > 0) {
                  initialExpenseItems[entry.id] = items;
                }
              } catch (e) {
                console.error(
                  `Error parsing expense items for entry ${entry.id}:`,
                  e
                );
              }
            }
          });

          // Set the expense items state
          setExpenseItemsByBillingId(initialExpenseItems);
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
            }
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
                initialFormData.dueDay
              );

              return {
                ...entry,
                dueDate: formatDueDate(dueDate),
              };
            }
          );

          initialFormData.billingSchedule = updatedSchedule;
        }

        setFormData(initialFormData);
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

    fetchPropertyDetails();
  }, [propertyId, isOpen]);

  const handleOtherChargesClick = (index: number) => {
    if (isLocked || !formData) return;

    // Add validation
    if (!formData.billingSchedule || !formData.billingSchedule[index]) {
      console.error(`No billing data found for index ${index}`);
      toast.error("Error: Could not find billing data");
      return;
    }

    // Set the selected billing index
    setSelectedBillingIndex(index);

    // Get the billing entry ID to ensure we're working with the correct one
    const billingEntryId = formData.billingSchedule[index].id;

    console.log(
      `Opening expenses for month ${index + 1}, billing ID: ${billingEntryId}`
    );

    // Open the popup
    setIsOtherChargesPopupOpen(true);
  };

  const handleSaveOtherCharges = (
    totalAmount: number,
    items: ExpenseItem[]
  ) => {
    if (selectedBillingIndex === null || !formData) return;

    // Get the current billing entry ID to ensure we're updating the correct one
    const billingEntryId = formData.billingSchedule[selectedBillingIndex].id;

    console.log(
      `Saving expenses for month ${
        selectedBillingIndex + 1
      }, billing ID: ${billingEntryId}, items count: ${items.length}`
    );

    // Create updated billing schedule
    const updatedSchedule = [...formData.billingSchedule];
    updatedSchedule[selectedBillingIndex] = {
      ...updatedSchedule[selectedBillingIndex],
      otherCharges: totalAmount,
      grossDue: updatedSchedule[selectedBillingIndex].rentDue + totalAmount,
    };

    // Save expense items for this specific billing entry ID
    setExpenseItemsByBillingId((prev) => {
      // Make sure we're setting by index AND by ID for temporary entries
      const updatedItems = { ...prev };

      // Save by ID
      updatedItems[billingEntryId] = items.map((item) => ({
        ...item,
        // Add month index to ensure proper tracking
        monthIndex: selectedBillingIndex,
      }));

      // Also save by month index for redundancy
      updatedItems[`month-${selectedBillingIndex}`] = items.map((item) => ({
        ...item,
        monthIndex: selectedBillingIndex,
      }));

      console.log("Updated expense items mapping:", updatedItems);
      return updatedItems;
    });

    // Update form data
    setFormData({
      ...formData,
      billingSchedule: updatedSchedule,
    });

    // Close popup
    setIsOtherChargesPopupOpen(false);
    setSelectedBillingIndex(null);

    // Show success message
    toast.success("Expense items updated", {
      description: `Successfully updated ${
        items.length
      } expense items for month ${selectedBillingIndex + 1}`,
    });
  };

  // Add this helper function to calculate the proper due date based on dueDay setting
  const calculateDueDate = (baseDate: Date, dueDay: string): Date => {
    // const year = baseDate.getFullYear(); //unused
    const month = baseDate.getMonth();

    const result = new Date(baseDate);

    if (dueDay === "1st - First Day") {
      result.setDate(1);
    } else if (dueDay === "15th - Mid Month") {
      result.setDate(15);
    } else {
      result.setMonth(month + 1, 0);
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
    value: string | number | boolean | Date
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
        (entry) => new Date(entry.dueDate) >= currentDate
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

  // Update billing status
  const updateBillingStatus = (index: number, status: string) => {
    if (
      !formData ||
      !formData.billingSchedule ||
      !formData.billingSchedule[index]
    ) {
      console.error(`Cannot update status for index ${index}: data not found`);
      return;
    }

    const updatedSchedule = [...formData.billingSchedule];
    updatedSchedule[index] = { ...updatedSchedule[index], status };
    setFormData({ ...formData, billingSchedule: updatedSchedule });
  };

  const addNewBillingMonth = () => {
    if (!formData || isLocked) return;

    const lastEntry =
      formData.billingSchedule[formData.billingSchedule.length - 1];
    if (!lastEntry) {
      toast.error("Cannot add new month without existing entries");
      return;
    }

    const lastDueDate = new Date(lastEntry.dueDate);
    const newMonth = new Date(lastDueDate);
    newMonth.setMonth(lastDueDate.getMonth() + 1);

    // Apply the due day setting
    const newDueDate = calculateDueDate(newMonth, formData.dueDay);

    // Format the new due date
    const formattedDueDate = formatDueDate(newDueDate);

    // Generate random other charges
    const otherCharges = Math.floor(Math.random() * 1500) + 500;

    // Create a new billing entry - use current property rent amount
    const newEntry = {
      id: `temp-${Date.now()}`, // Temporary ID until saved to database
      dueDate: formattedDueDate,
      rentDue: formData.rentAmount, // Use current property rent amount
      otherCharges: otherCharges,
      grossDue: formData.rentAmount + otherCharges, // Calculate based on current rent
      status: "Not Yet Due",
    };

    // Update form data with the new entry
    setFormData({
      ...formData,
      billingSchedule: [...formData.billingSchedule, newEntry],
    });

    toast.success("New billing month added", {
      description: "Don't forget to save your changes",
    });
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
            updated_at: new Date().toISOString(),
          })
          .eq("id", formData.tenantId);

        if (tenantError) throw tenantError;

        // Handle billing entries
        for (const entry of formData.billingSchedule) {
          // Get expense items for this entry
          const expenseItems = expenseItemsByBillingId[entry.id] || [];

          // For existing entries, update them
          if (!entry.id.startsWith("temp-")) {
            const { error: billingError } = await supabase
              .from("billing_entries")
              .update({
                status: entry.status,
                other_charges: entry.otherCharges,
                rent_due: entry.rentDue,
                gross_due: entry.grossDue,
                expense_items:
                  expenseItems.length > 0 ? JSON.stringify(expenseItems) : null,
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
                expense_items:
                  expenseItems.length > 0 ? JSON.stringify(expenseItems) : null,
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
        (id) => !currentEntryIds.includes(id)
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

      // Close the dialog
      onClose();
    } catch (err) {
      console.error("Error updating property:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update property"
      );
      toast.error("Failed to update property");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete billing row
  const deleteBillingRow = (index: number) => {
    if (!formData || isLocked) return;

    // Confirm deletion
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this billing entry?"
    );
    if (!confirmDelete) return;

    // Remove the entry from the form data
    const updatedSchedule = formData.billingSchedule.filter(
      (entry, i) => i !== index
    );
    setFormData({ ...formData, billingSchedule: updatedSchedule });

    toast.success("Billing entry deleted", {
      description: "The billing entry has been removed.",
    });
  };

  // Add this function to handle the actual deletion
  const handleDeleteProperty = async () => {
    if (!formData) return;

    setIsDeleting(true);

    try {
      // First, delete any billing entries associated with this property
      if (formData.tenantId) {
        const { error: billingDeleteError } = await supabase
          .from("billing_entries")
          .delete()
          .eq("property_id", formData.id);

        if (billingDeleteError) throw billingDeleteError;

        // Then delete the tenant
        const { error: tenantDeleteError } = await supabase
          .from("tenants")
          .delete()
          .eq("id", formData.tenantId);

        if (tenantDeleteError) throw tenantDeleteError;
      }

      // Finally delete the property
      const { error: propertyDeleteError } = await supabase
        .from("properties")
        .delete()
        .eq("id", formData.id);

      if (propertyDeleteError) throw propertyDeleteError;

      // Show success message
      toast.success("Property deleted successfully", {
        description: `${formData.unitName} and all associated data have been permanently removed.`,
      });

      // Call the success callback if provided
      if (onSuccess) onSuccess();

      // Close the dialog
      onClose();
    } catch (err) {
      console.error("Error deleting property:", err);
      setError(
        err instanceof Error ? err.message : "Failed to delete property"
      );
      toast.error("Failed to delete property");
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="sm:max-w-[900px]">
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
        className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto"
        aria-describedby="dialog-description"
      >
        <DialogHeader className="flex flex-row items-center justify-between pt-5">
          <div>
            <DialogTitle className="text-xl flex items-center">
              <Building className="mr-2 h-5 w-5" />
              Edit Property: {formData.unitName}
            </DialogTitle>
            <DialogDescription id="dialog-description">
              Update property information, tenant details, and payment statuses.
            </DialogDescription>
          </div>

          {/* Move lock toggle here */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 mr-1">
              {isLocked ? (
                <Lock className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Unlock className="h-4 w-4 text-green-600" />
              )}
              <span className="text-sm font-medium hidden sm:inline">
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
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        onChange={(e) =>
                          handleChange(
                            "rentAmount",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        disabled={isLocked}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 bg-muted/20 p-3 rounded-md">
                    <p className="text-xs text-muted-foreground">
                      Property ID: {formData.id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Occupancy Status: {formData.occupancyStatus}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Property Location cannot be modified
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
                      <Label htmlFor="rentStartDate">Rent Start Date</Label>
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
                      <Label htmlFor="dueDay">Payment Due Date</Label>
                      <Select
                        value={formData.dueDay}
                        onValueChange={(value) => handleChange("dueDay", value)}
                        disabled={isLocked}
                      >
                        <SelectTrigger className={isLocked ? "opacity-70" : ""}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30th/31st - Last Day">
                            30th/31st - Last Day of Month
                          </SelectItem>
                          <SelectItem value="15th - Mid Month">
                            15th - Mid Month
                          </SelectItem>
                          <SelectItem value="1st - First Day">
                            1st - First Day of Month
                          </SelectItem>
                        </SelectContent>
                      </Select>
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

          {/* Payment Status Section */}
          {formData.occupancyStatus === "occupied" &&
            formData.billingSchedule.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <Calendar className="mr-2 h-4 w-4" />
                  Payment Status
                </h2>
                <Card>
                  <CardContent className="p-6">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="text-left border-b">
                            <th className="pb-2 font-medium">Period</th>
                            <th className="pb-2 font-medium">Due Date</th>
                            <th className="pb-2 font-medium">Rent</th>
                            <th className="pb-2 font-medium">Other</th>
                            <th className="pb-2 font-medium">Total</th>
                            <th className="pb-2 font-medium">Status</th>
                            <th className="pb-2 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.billingSchedule
                            .filter((entry) => entry)
                            .map((entry, index) => {
                              // Check if this is the last row
                              const isLastRow =
                                index === formData.billingSchedule.length - 1;

                              return (
                                <tr
                                  key={entry.id || `row-${index}`}
                                  className="border-b border-muted hover:bg-muted/50"
                                >
                                  <td className="py-3 text-sm">
                                    Month {index + 1}
                                  </td>
                                  <td className="py-3 text-sm">
                                    {entry.dueDate}
                                  </td>
                                  <td className="py-3 text-sm font-medium">
                                    ₱{(entry.rentDue || 0).toLocaleString()}
                                  </td>
                                  <td className="py-3 text-sm">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleOtherChargesClick(index)
                                      }
                                      disabled={isLocked}
                                      className={`px-2 py-1 h-auto ${
                                        isLocked ? "opacity-70" : ""
                                      }`}
                                    >
                                      ₱
                                      {(
                                        entry.otherCharges || 0
                                      ).toLocaleString()}
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="ml-1 h-3 w-3"
                                      >
                                        <path d="M5 12h14"></path>
                                        <path d="M12 5v14"></path>
                                      </svg>
                                    </Button>
                                  </td>
                                  <td className="py-3 text-sm font-medium">
                                    ₱{(entry.grossDue || 0).toLocaleString()}
                                  </td>
                                  <td className="py-3">
                                    <Select
                                      value={entry.status}
                                      onValueChange={(value) =>
                                        updateBillingStatus(index, value)
                                      }
                                      disabled={isLocked}
                                    >
                                      <SelectTrigger
                                        className={`w-40 ${
                                          isLocked ? "opacity-70" : ""
                                        }`}
                                      >
                                        <SelectValue>
                                          {entry.status}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="Collected - Cash">
                                          Collected - Cash
                                        </SelectItem>
                                        <SelectItem value="Collected - Cheque">
                                          Collected - Cheque
                                        </SelectItem>
                                        <SelectItem value="Collected - Bank Transfer">
                                          Collected - Bank Transfer
                                        </SelectItem>
                                        <SelectItem value="Delayed">
                                          Delayed
                                        </SelectItem>
                                        <SelectItem value="Not Yet Due">
                                          Not Yet Due
                                        </SelectItem>
                                        <SelectItem value="Overdue">
                                          Overdue
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="py-3 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteBillingRow(index)}
                                      disabled={isLocked || !isLastRow}
                                      className={`text-red-500 hover:text-red-700 hover:bg-red-50 ${
                                        isLastRow && !isLocked
                                          ? ""
                                          : "opacity-30 cursor-not-allowed"
                                      }`}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="h-4 w-4"
                                      >
                                        <path d="M3 6h18"></path>
                                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                        <line
                                          x1="10"
                                          y1="11"
                                          x2="10"
                                          y2="17"
                                        ></line>
                                        <line
                                          x1="14"
                                          y1="11"
                                          x2="14"
                                          y2="17"
                                        ></line>
                                      </svg>
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>

                    {/* Add New Month Button */}
                    <div className="mt-6 flex justify-end">
                      <Button
                        onClick={addNewBillingMonth}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                        disabled={isLocked}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="16"></line>
                          <line x1="8" y1="12" x2="16" y2="12"></line>
                        </svg>
                        Add New Month
                      </Button>
                    </div>
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
          {selectedBillingIndex !== null && formData && (
            <OtherChargesPopup
              isOpen={isOtherChargesPopupOpen}
              onClose={() => {
                setIsOtherChargesPopupOpen(false);
                setSelectedBillingIndex(null);
              }}
              onSave={handleSaveOtherCharges}
              initialTotal={
                formData.billingSchedule[selectedBillingIndex].otherCharges
              }
              month={selectedBillingIndex + 1}
              dueDate={formData.billingSchedule[selectedBillingIndex].dueDate}
              disabled={isLocked}
              // Pass existing expense items for this specific billing entry
              existingItems={
                expenseItemsByBillingId[
                  formData.billingSchedule[selectedBillingIndex].id
                ] || []
              }
            />
          )}
        </div>

        <Separator className="my-6" />

        <div className="flex justify-between gap-4">
          {/* Delete button - left side */}
          <Button
            variant="destructive"
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={submitting || isLocked}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete Property
          </Button>

          {/* Save/Cancel buttons - right side */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || isLocked}
              className={`gap-2 ${
                isLocked ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Delete confirmation dialog */}
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Delete Property Permanently
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  Are you sure you want to delete{" "}
                  <strong>{formData?.unitName}</strong>? This action cannot be
                  undone and will permanently remove:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>The property record</li>
                  {formData?.occupancyStatus === "occupied" && (
                    <>
                      <li>Tenant information for {formData?.tenantName}</li>
                      <li>
                        All {formData?.billingSchedule.length} billing entries
                      </li>
                      <li>All associated expense items</li>
                    </>
                  )}
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteProperty();
                }}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  "Delete Permanently"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
