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
  Plus,
  Minus,
  Mail,
  Phone,
  X,
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

interface PersonDetail {
  name: string;
  email: string;
  phone: string;
}

interface Tenant {
  id: string;
  property_id: string;
  tenant_name: string;
  contact_number: string;
  pax?: number;
  pax_details?: PersonDetail[];
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
  paxDetails: PersonDetail[];
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
  const [editingPersonIndex, setEditingPersonIndex] = useState<number | null>(
    null,
  );

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
          .order("billing_period", {
            foreignTable: "tenants.billing_entries",
            ascending: true,
          })
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
          paxDetails: activeTenant?.pax_details || [],
          contractMonths: activeTenant?.contract_months || 0,
          rentStartDate: activeTenant?.rent_start_date || "",
          dueDay: activeTenant?.due_day || "30th/31st - Last Day",
          billingSchedule: [],
        };

        // Ensure Person 1 is populated with the tenant's info
        if (activeTenant) {
          const tenantAsPerson1 = {
            name: activeTenant.tenant_name || "",
            email: "",
            phone: activeTenant.contact_number || "",
          };

          // If pax_details exists and has Person 1, merge with tenant data
          if (
            initialFormData.paxDetails.length > 0 &&
            initialFormData.paxDetails[0]
          ) {
            initialFormData.paxDetails[0] = {
              ...tenantAsPerson1,
              email: initialFormData.paxDetails[0].email || "",
            };
          } else {
            // Ensure paxDetails array has at least Person 1
            initialFormData.paxDetails = [
              tenantAsPerson1,
              ...initialFormData.paxDetails.slice(1),
            ];
          }

          // Ensure paxDetails array matches pax count
          while (initialFormData.paxDetails.length < initialFormData.pax) {
            initialFormData.paxDetails.push({ name: "", email: "", phone: "" });
          }
        }

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

    // Sync tenant fields to Person 1 in paxDetails
    if (field === "tenantName" && updatedFormData.paxDetails.length > 0) {
      updatedFormData.paxDetails[0] = {
        ...updatedFormData.paxDetails[0],
        name: value as string,
      };
    } else if (
      field === "contactNumber" &&
      updatedFormData.paxDetails.length > 0
    ) {
      updatedFormData.paxDetails[0] = {
        ...updatedFormData.paxDetails[0],
        phone: value as string,
      };
    }

    // Initialize pax details when changing from vacant to occupied
    if (field === "occupancyStatus" && value === "occupied") {
      // Ensure we have at least Person 1 with empty details
      if (updatedFormData.paxDetails.length === 0) {
        updatedFormData.paxDetails = [{ name: "", email: "", phone: "" }];
        updatedFormData.pax = 1;

        toast.info("Property set to occupied", {
          description:
            "Please fill in Person 1 details below (tenant information required)",
        });
      }
    }

    // Set the updated form data
    setFormData(updatedFormData);
  };

  // Helper functions for managing person details
  const handleAddPerson = () => {
    if (!formData) return;
    const newPax = formData.pax + 1;
    if (newPax > 20) {
      toast.error("Maximum 20 persons allowed");
      return;
    }

    const updatedPaxDetails = [...formData.paxDetails];
    updatedPaxDetails.push({ name: "", email: "", phone: "" });

    setFormData({
      ...formData,
      pax: newPax,
      paxDetails: updatedPaxDetails,
    });
    setEditingPersonIndex(updatedPaxDetails.length - 1);
  };

  const handleRemovePerson = (index: number) => {
    if (!formData) return;
    if (formData.pax <= 1) {
      toast.error("At least 1 person required");
      return;
    }

    if (index === 0) {
      toast.error("Cannot remove Person 1", {
        description:
          "At least one tenant is required. You can edit Person 1 details instead.",
      });
      return;
    }

    const updatedPaxDetails = formData.paxDetails.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      pax: formData.pax - 1,
      paxDetails: updatedPaxDetails,
    });
  };

  const handleUpdatePersonDetail = (
    index: number,
    field: keyof PersonDetail,
    value: string,
  ) => {
    if (!formData) return;

    const updatedPaxDetails = [...formData.paxDetails];
    updatedPaxDetails[index] = {
      ...updatedPaxDetails[index],
      [field]: value,
    };

    setFormData({
      ...formData,
      paxDetails: updatedPaxDetails,
    });
  };

  const handlePaxNumberChange = (newPax: number) => {
    if (!formData) return;

    const updatedPaxDetails = [...formData.paxDetails];

    // Ensure Person 1 always exists
    if (updatedPaxDetails.length === 0) {
      updatedPaxDetails.push({
        name: formData.tenantName,
        email: "",
        phone: formData.contactNumber,
      });
    }

    // Add empty person details if increasing pax
    while (updatedPaxDetails.length < newPax) {
      updatedPaxDetails.push({ name: "", email: "", phone: "" });
    }

    // Remove person details if decreasing pax (but never remove Person 1)
    while (updatedPaxDetails.length > newPax && updatedPaxDetails.length > 1) {
      updatedPaxDetails.pop();
    }

    setFormData({
      ...formData,
      pax: newPax,
      paxDetails: updatedPaxDetails,
    });
  };

  // Submit the form
  const handleSubmit = async () => {
    if (!formData) return;

    // Check if user has started filling in tenant details
    const person1 = formData.paxDetails[0];
    const hasPaxData = person1 && person1.name && person1.name.trim() !== "";

    // If tenant data is being filled (regardless of occupancy status), validate all required fields
    if (hasPaxData || formData.occupancyStatus === "occupied") {
      // Validate Person 1 has name
      if (!person1 || !person1.name || person1.name.trim() === "") {
        toast.error("Person 1 name is required", {
          description:
            "Please fill in the name for Person 1 in the Individual Person Details section",
        });
        return;
      }

      // Validate rent start date is required
      if (!formData.rentStartDate || formData.rentStartDate.trim() === "") {
        toast.error("Rent Agreement Date is required", {
          description: "Please set the rent agreement date for the tenant",
        });
        return;
      }

      // Validate due day is set
      if (!formData.dueDay || formData.dueDay.trim() === "") {
        toast.error("Payment Due Day is required", {
          description: "Please set the payment due day of the month",
        });
        return;
      }

      // Validate pax is at least 1
      if (!formData.pax || formData.pax < 1) {
        toast.error("Number of Pax is required", {
          description: "Please set the number of occupants (at least 1)",
        });
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      // Automatically determine occupancy status based on tenant data
      // If tenant exists (Person 1 has a name) → occupied
      // If no tenant (Person 1 has no name) → vacant
      const finalOccupancyStatus = hasPaxData ? "occupied" : "vacant";

      // Update property info (including occupancy status)
      const { error: propertyError } = await supabase
        .from("properties")
        .update({
          unit_name: formData.unitName,
          property_type: formData.propertyType,
          property_location: formData.propertyLocation,
          rent_amount: formData.rentAmount,
          occupancy_status: finalOccupancyStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", formData.id);

      if (propertyError) throw propertyError;

      if (formData.occupancyStatus === "occupied" || hasPaxData) {
        // Get tenant name and contact from Person 1 (first person in paxDetails)
        const person1Data = formData.paxDetails[0] || {
          name: "",
          phone: "",
          email: "",
        };

        const tenantData = {
          tenant_name: person1Data.name || formData.tenantName,
          contact_number: person1Data.phone || formData.contactNumber,
          rent_start_date: formData.rentStartDate,
          due_day: formData.dueDay,
          pax: formData.pax,
          pax_details: formData.paxDetails,
          updated_at: new Date().toISOString(),
        };

        if (formData.tenantId) {
          // Update existing tenant
          console.log("Updating tenant with data:", tenantData);

          const { error: tenantError } = await supabase
            .from("tenants")
            .update(tenantData)
            .eq("id", formData.tenantId);

          if (tenantError) {
            console.error("Tenant update error:", tenantError);
            throw tenantError;
          }
        } else {
          // Create new tenant for previously vacant property
          console.log("Creating new tenant with data:", tenantData);

          const { data: newTenant, error: tenantError } = await supabase
            .from("tenants")
            .insert({
              ...tenantData,
              property_id: formData.id,
              is_active: true,
              contract_months: formData.contractMonths || 12,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (tenantError) {
            console.error("Tenant creation error:", tenantError);
            throw tenantError;
          }

          // Update formData with new tenant ID for billing entries
          if (newTenant) {
            formData.tenantId = newTenant.id;
          }
        }

        // Handle billing entries only for occupied properties
        if (formData.occupancyStatus === "occupied") {
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

          // Track deleted entries that need to be removed from database
          const currentEntryIds = formData.billingSchedule.map(
            (entry) => entry.id,
          );
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
        }
      }

      const hasTenantData =
        person1 && person1.name && person1.name.trim() !== "";
      const savedWhat = hasTenantData
        ? `${formData.unitName} and ${formData.pax} person detail${formData.pax > 1 ? "s" : ""} saved`
        : `${formData.unitName} updated`;

      toast.success("Property updated successfully", {
        description: savedWhat,
      });

      // Call the success callback if provided
      if (onSuccess) onSuccess();

      // Close the dialog AFTER all operations are successful
      onClose();
    } catch (err) {
      console.error("Error updating property:", err);
      console.error("Error details:", JSON.stringify(err, null, 2));

      let errorMessage = "Failed to update property";

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null) {
        // Handle Supabase error format
        const supabaseError = err as any;
        if (supabaseError.message) {
          errorMessage = supabaseError.message;
        } else if (supabaseError.error_description) {
          errorMessage = supabaseError.error_description;
        } else if (supabaseError.hint) {
          errorMessage = `${supabaseError.message || "Database error"}: ${supabaseError.hint}`;
        }
      }

      setError(errorMessage);
      toast.error("Failed to update property", {
        description: errorMessage,
      });
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
                      value={formData.unitName ?? ""}
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
                        value={formData.rentAmount ?? ""}
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
                      value={formData.propertyLocation ?? ""}
                      onChange={(e) =>
                        handleChange("propertyLocation", e.target.value)
                      }
                      disabled={isLocked}
                      className={isLocked ? "opacity-70" : ""}
                      placeholder="Enter property address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="occupancyStatus">Occupancy Status</Label>
                    <Select
                      value={formData.occupancyStatus}
                      onValueChange={(value) =>
                        handleChange("occupancyStatus", value)
                      }
                      disabled={isLocked}
                    >
                      <SelectTrigger
                        id="occupancyStatus"
                        className={isLocked ? "opacity-70" : ""}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vacant">Vacant</SelectItem>
                        <SelectItem value="occupied">Occupied</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 bg-muted/20 p-3 rounded-md">
                    <p className="text-xs text-muted-foreground">
                      Property ID: {formData.id}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Tenant Info Section */}
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <User className="mr-2 h-4 w-4" />
              Tenant Information
            </h2>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pax" className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      Number of Pax (Bed Space)
                    </Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (formData.pax > 1) {
                            handleRemovePerson(formData.pax - 1);
                          }
                        }}
                        disabled={isLocked || formData.pax <= 1}
                        className={isLocked ? "opacity-70" : ""}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        id="pax"
                        type="number"
                        min="1"
                        max="20"
                        value={formData.pax ?? 1}
                        onChange={(e) => {
                          const value = e.target.value.replace(/^0+(?=\d)/, "");
                          const newPax = parseInt(value) || 1;
                          handlePaxNumberChange(newPax);
                        }}
                        disabled={isLocked}
                        className={`flex-1 ${isLocked ? "opacity-70" : ""}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleAddPerson}
                        disabled={isLocked || formData.pax >= 20}
                        className={isLocked ? "opacity-70" : ""}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Number of persons sharing this unit
                    </p>
                    {formData.pax >= 1 && property && property.rent_amount && (
                      <div className="mt-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                          Per-Person Rent: ₱
                          {(property.rent_amount / formData.pax).toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            },
                          )}
                        </p>
                        <p className="text-[10px] text-blue-700 dark:text-blue-300 mt-0.5">
                          Total ₱{property.rent_amount.toLocaleString()} ÷{" "}
                          {formData.pax} persons
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rentStartDate"> Rent Agreement Date</Label>
                    <Input
                      id="rentStartDate"
                      type="date"
                      value={formData.rentStartDate ?? ""}
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
                          formData.dueDay === "last" ||
                          formData.dueDay === "30th/31st - Last Day"
                            ? "default"
                            : "outline"
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
                          formData.dueDay === "last" ||
                          formData.dueDay === "30th/31st - Last Day"
                            ? ""
                            : formData.dueDay
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
                      Select a preset or enter a custom day (1-31). Note: Day 31
                      will adjust to last day for shorter months.
                    </p>
                  </div>
                </div>

                {/* Person Details Section - Full Width */}
                {formData.pax > 0 && !isLocked && (
                  <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <h3 className="text-base font-semibold">
                          Individual Person Details
                        </h3>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Manage individual tenant details. All information is saved
                      to the database automatically when you save changes.
                      <span className="text-red-500"> * Required field</span>
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Array.from({ length: formData.pax }, (_, index) => {
                        const person = formData.paxDetails[index] || {
                          name: "",
                          email: "",
                          phone: "",
                        };
                        const isEditing = editingPersonIndex === index;

                        return (
                          <Card
                            key={index}
                            className={`border-blue-200 dark:border-blue-800 hover:shadow-md transition-shadow ${
                              index === 0
                                ? "ring-2 ring-blue-400 dark:ring-blue-600"
                                : ""
                            }`}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`h-9 w-9 rounded-full flex items-center justify-center ${
                                      index === 0
                                        ? "bg-blue-600 dark:bg-blue-500"
                                        : "bg-blue-100 dark:bg-blue-900/30"
                                    }`}
                                  >
                                    <User
                                      className={`h-4 w-4 ${
                                        index === 0
                                          ? "text-white"
                                          : "text-blue-600 dark:text-blue-400"
                                      }`}
                                    />
                                  </div>
                                  <div>
                                    <span className="text-sm font-semibold">
                                      Person {index + 1}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setEditingPersonIndex(
                                        isEditing ? null : index,
                                      )
                                    }
                                    className="h-7 text-xs"
                                  >
                                    {isEditing ? "Done" : "Edit"}
                                  </Button>
                                  {index > 0 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemovePerson(index)}
                                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
                                      title="Remove this person"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {isEditing ? (
                                <div className="space-y-3">
                                  <div>
                                    <Label
                                      htmlFor={`person-${index}-name`}
                                      className="text-xs mb-1"
                                    >
                                      Name{" "}
                                      {index === 0 && (
                                        <span className="text-red-500">*</span>
                                      )}
                                    </Label>
                                    <Input
                                      id={`person-${index}-name`}
                                      value={person.name ?? ""}
                                      onChange={(e) =>
                                        handleUpdatePersonDetail(
                                          index,
                                          "name",
                                          e.target.value,
                                        )
                                      }
                                      placeholder={
                                        index === 0
                                          ? "Enter full name (required)"
                                          : "Enter full name"
                                      }
                                      className="h-9"
                                      required={index === 0}
                                    />
                                  </div>
                                  <div>
                                    <Label
                                      htmlFor={`person-${index}-email`}
                                      className="text-xs flex items-center gap-1 mb-1"
                                    >
                                      <Mail className="h-3 w-3" />
                                      Email
                                    </Label>
                                    <Input
                                      id={`person-${index}-email`}
                                      type="email"
                                      value={person.email ?? ""}
                                      onChange={(e) =>
                                        handleUpdatePersonDetail(
                                          index,
                                          "email",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="Enter email address"
                                      className="h-9"
                                    />
                                  </div>
                                  <div>
                                    <Label
                                      htmlFor={`person-${index}-phone`}
                                      className="text-xs flex items-center gap-1 mb-1"
                                    >
                                      <Phone className="h-3 w-3" />
                                      Phone
                                    </Label>
                                    <Input
                                      id={`person-${index}-phone`}
                                      type="tel"
                                      value={person.phone ?? ""}
                                      onChange={(e) =>
                                        handleUpdatePersonDetail(
                                          index,
                                          "phone",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="Enter phone number"
                                      className="h-9"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {person.name ? (
                                    <>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-0.5">
                                          Name
                                        </p>
                                        <p className="text-sm font-medium">
                                          {person.name}
                                        </p>
                                      </div>
                                      {person.email && (
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-0.5">
                                            Email
                                          </p>
                                          <p className="text-xs flex items-center gap-1.5">
                                            <Mail className="h-3 w-3 text-muted-foreground" />
                                            {person.email}
                                          </p>
                                        </div>
                                      )}
                                      {person.phone && (
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-0.5">
                                            Phone
                                          </p>
                                          <p className="text-xs flex items-center gap-1.5">
                                            <Phone className="h-3 w-3 text-muted-foreground" />
                                            {person.phone}
                                          </p>
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div className="text-center py-4">
                                      <p className="text-xs text-muted-foreground italic">
                                        No details added yet
                                      </p>
                                      <p className="text-[10px] text-muted-foreground mt-1">
                                        Click Edit to add information
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

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

          {formData.occupancyStatus === "vacant" && (
            <Alert className="bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800">
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription>
                This property is currently vacant. Change the occupancy status
                to "Occupied" above to add tenant information and person
                details.
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
