"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { UpdatePropertyInput } from "@unitko/shared";
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
import {
  Building,
  User,
  Loader2,
  AlertCircle,
  Save,
  Lock,
  Unlock,
  ArrowRightLeft,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import {
  PropertyDetailsSection,
  PaymentScheduleSection,
  OccupantDetailsSection,
  SwitchBillingDialog,
  type PropertyFormData,
  type PersonDetail,
  type OccupantLinkage,
  type BillingFrequency,
  type EditPropertyPopupProps,
  calculatePeriodDueDate,
  formatDueDate,
  inferBillingFrequency,
  isWeekDayValue,
  isValidBiWeeklyDueDayPair,
} from "./edit-property";

// Re-export types for backward compatibility
export type {
  PropertyFormData,
  PersonDetail,
  OccupantLinkage,
  BillingFrequency,
  EditPropertyPopupProps,
};

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
  const [formData, setFormData] = useState<PropertyFormData | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [editingPersonIndex, setEditingPersonIndex] = useState<number | null>(
    null,
  );
  const [occupantLinkage, setOccupantLinkage] = useState<OccupantLinkage>({
    tenantIds: [],
    removedTenantIds: [],
  });

  // Fetch property data when the popup opens
  useEffect(() => {
    const fetchPropertyDetails = async () => {
      if (!isOpen || !propertyId) return;

      setLoading(true);
      setError(null);

      try {
        const [detail, invoices] = await Promise.all([
          api.properties.detail(propertyId),
          api.billing.list(propertyId),
        ]);

        // Active occupants (identity only here) sorted by slot; lease/billing
        // terms are inferred from the invoices below.
        const activeTenants = detail.tenants
          .filter((t) => t.isActive)
          .sort((a, b) => (a.tenantSlot ?? 0) - (b.tenantSlot ?? 0));

        const firstTenant = activeTenants[0];
        const initialPax = activeTenants.length || 1;

        // paxDetails + tenantIds stay in lockstep so save can map each occupant
        // back to its tenant row.
        const paxDetails: PersonDetail[] =
          activeTenants.length > 0
            ? activeTenants.map((t) => ({
                name: t.tenantName || "",
                email: t.email || "",
                phone: t.contactNumber || "",
              }))
            : [{ name: "", email: "", phone: "" }];

        const tenantIds: (string | undefined)[] =
          activeTenants.length > 0
            ? activeTenants.map((t) => t.id)
            : [undefined];

        // The schedule is read-only in this dialog (the Edit Billing popup owns
        // per-invoice edits); lease terms that have no dedicated read endpoint
        // yet — frequency, contract length, due day — are inferred from it.
        const schedule = [...invoices].sort(
          (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0),
        );
        const firstDueDate = schedule.find((e) => e.dueDate)?.dueDate ?? "";
        const inferredDueDay = firstDueDate
          ? String(Number.parseInt(firstDueDate.slice(8, 10), 10))
          : "last";

        const initialFormData: PropertyFormData = {
          id: detail.id,
          unitName: detail.unitName,
          propertyType: detail.propertyType ?? "",
          propertyLocation: detail.propertyLocation ?? "",
          occupancyStatus: detail.occupancyStatus,
          rentAmount: detail.rentAmount,
          maxTenants: detail.maxTenants ?? initialPax,
          tenantId: firstTenant?.id,
          tenantName: firstTenant?.tenantName || "",
          contactNumber: firstTenant?.contactNumber || "",
          pax: initialPax,
          paxDetails,
          // Prefer the real lease terms now returned by the API; fall back to the
          // values inferred from invoices for properties created before this read
          // existed (or with no active lease).
          contractMonths: detail.lease?.contractPeriods ?? schedule.length,
          rentStartDate:
            detail.lease?.rentStartDate ??
            (firstDueDate ? firstDueDate.slice(0, 10) : ""),
          formBasis:
            detail.lease?.billingFrequency ?? inferBillingFrequency(schedule),
          rentPerPerson:
            initialPax > 0
              ? Number((detail.rentAmount / initialPax).toFixed(2))
              : detail.rentAmount,
          dueDay:
            detail.lease?.dueDay != null
              ? String(detail.lease.dueDay)
              : inferredDueDay,
          billingSchedule: schedule.map((entry) => ({
            id: entry.id,
            dueDate: entry.dueDate ?? "",
            rentDue: entry.rentDue,
            otherCharges: entry.otherCharges,
            grossDue: entry.grossDue,
            status: entry.status,
            paidAmount: entry.paidAmount,
          })),
        };

        setOccupantLinkage({ tenantIds, removedTenantIds: [] });
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

  const handleChange = (
    field: keyof PropertyFormData,
    value: string | number | boolean | Date | BillingFrequency,
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
      updatedFormData.rentPerPerson =
        updatedFormData.pax > 0
          ? Number((newRentAmount / updatedFormData.pax).toFixed(2))
          : newRentAmount;

      const updatedCount = updatedSchedule.filter(
        (entry) => new Date(entry.dueDate) >= currentDate,
      ).length;

      toast.success("Rent amount updated", {
        description: `Updated rent for ${updatedCount} upcoming payment${
          updatedCount !== 1 ? "s" : ""
        }. Past payments were not affected.`,
      });
    } else if (field === "rentPerPerson") {
      const newPerPerson =
        typeof value === "number" ? value : parseFloat(value as string) || 0;
      updatedFormData.rentPerPerson = newPerPerson;

      const recalculatedTotalRent =
        Math.max(1, updatedFormData.pax) * newPerPerson;
      updatedFormData.rentAmount = recalculatedTotalRent;

      if (formData.billingSchedule.length > 0) {
        const currentDate = new Date();
        updatedFormData.billingSchedule = formData.billingSchedule.map(
          (entry) => {
            const dueDate = new Date(entry.dueDate);
            if (dueDate < currentDate) return entry;

            const updatedRentDue = recalculatedTotalRent;
            return {
              ...entry,
              rentDue: updatedRentDue,
              grossDue: updatedRentDue + entry.otherCharges,
            };
          },
        );
      }
    } else if (field === "dueDay" && formData.billingSchedule.length > 0) {
      // When due marker changes, update all billing dates using selected frequency.
      const baseDate = updatedFormData.rentStartDate
        ? new Date(updatedFormData.rentStartDate)
        : new Date();

      const updatedSchedule = formData.billingSchedule.map((entry, index) => {
        const newDueDate = calculatePeriodDueDate(
          baseDate,
          index,
          updatedFormData.formBasis,
          value as string,
        );

        return {
          ...entry,
          dueDate: formatDueDate(newDueDate),
        };
      });

      updatedFormData.billingSchedule = updatedSchedule;

      toast.success("Payment dates updated", {
        description:
          "All billing dates have been adjusted to match the selected frequency and due marker",
      });
    } else if (
      (field === "formBasis" || field === "rentStartDate") &&
      formData.billingSchedule.length > 0
    ) {
      if (field === "formBasis") {
        const nextBasis = value as BillingFrequency;
        if (nextBasis === "weekly" && !isWeekDayValue(updatedFormData.dueDay)) {
          updatedFormData.dueDay = "monday";
        }
        if (
          nextBasis !== "weekly" &&
          nextBasis !== "bi-weekly" &&
          isWeekDayValue(updatedFormData.dueDay)
        ) {
          updatedFormData.dueDay = "1";
        }
        if (
          nextBasis === "bi-weekly" &&
          !isValidBiWeeklyDueDayPair(updatedFormData.dueDay)
        ) {
          updatedFormData.dueDay = "1,16";
        }
      }

      const baseDate =
        field === "rentStartDate" && typeof value === "string" && value
          ? new Date(value)
          : updatedFormData.rentStartDate
            ? new Date(updatedFormData.rentStartDate)
            : new Date();

      const updatedSchedule = formData.billingSchedule.map((entry, index) => {
        const newDueDate = calculatePeriodDueDate(
          baseDate,
          index,
          updatedFormData.formBasis,
          updatedFormData.dueDay,
        );

        return {
          ...entry,
          dueDate: formatDueDate(newDueDate),
        };
      });

      updatedFormData.billingSchedule = updatedSchedule;
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
    setOccupantLinkage((prev) => ({
      ...prev,
      tenantIds: [...prev.tenantIds, undefined],
    }));
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

    const removedTenantId = occupantLinkage.tenantIds[index];

    const updatedPaxDetails = formData.paxDetails.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      pax: formData.pax - 1,
      paxDetails: updatedPaxDetails,
    });
    setOccupantLinkage((prev) => ({
      tenantIds: prev.tenantIds.filter((_, i) => i !== index),
      removedTenantIds: removedTenantId
        ? [...prev.removedTenantIds, removedTenantId]
        : prev.removedTenantIds,
    }));
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
    const updatedTenantIds = [...occupantLinkage.tenantIds];
    const newlyRemovedTenantIds: string[] = [];

    // Ensure Person 1 always exists in lockstep arrays.
    if (updatedPaxDetails.length === 0) {
      updatedPaxDetails.push({
        name: formData.tenantName,
        email: "",
        phone: formData.contactNumber,
      });
      updatedTenantIds.push(undefined);
    }

    // Add empty person details if increasing pax.
    while (updatedPaxDetails.length < newPax) {
      updatedPaxDetails.push({ name: "", email: "", phone: "" });
      updatedTenantIds.push(undefined);
    }

    // Remove from the tail if decreasing pax (Person 1 is sticky). Capture
    // any popped tenantIds so the save path can soft-delete them.
    while (updatedPaxDetails.length > newPax && updatedPaxDetails.length > 1) {
      updatedPaxDetails.pop();
      const poppedId = updatedTenantIds.pop();
      if (poppedId) newlyRemovedTenantIds.push(poppedId);
    }

    const updatedData: PropertyFormData = {
      ...formData,
      pax: newPax,
      paxDetails: updatedPaxDetails,
    };

    setOccupantLinkage((prev) => ({
      tenantIds: updatedTenantIds,
      removedTenantIds:
        newlyRemovedTenantIds.length > 0
          ? [...prev.removedTenantIds, ...newlyRemovedTenantIds]
          : prev.removedTenantIds,
    }));

    if (updatedData.rentPerPerson > 0) {
      const recalculatedTotalRent = updatedData.rentPerPerson * newPax;
      updatedData.rentAmount = recalculatedTotalRent;
      updatedData.billingSchedule = updatedData.billingSchedule.map(
        (entry) => ({
          ...entry,
          rentDue: recalculatedTotalRent,
          grossDue: recalculatedTotalRent + entry.otherCharges,
        }),
      );
    }

    setFormData(updatedData);
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

      // Validate due day is set for frequencies that use a marker
      if (
        formData.formBasis === "bi-weekly"
          ? !isValidBiWeeklyDueDayPair(formData.dueDay)
          : !formData.dueDay || formData.dueDay.trim() === ""
      ) {
        toast.error("Payment Due Marker is required", {
          description:
            formData.formBasis === "bi-weekly"
              ? "Please choose two valid bi-weekly collection dates."
              : "Please set the payment due marker for each billing period",
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

      if (!formData.contractMonths || formData.contractMonths < 1) {
        toast.error("Contract duration is required", {
          description: "Please provide the number of billing periods.",
        });
        return;
      }

      if (!formData.formBasis) {
        toast.error("Frequency basis is required", {
          description: "Please select a billing frequency.",
        });
        return;
      }

      if (!formData.rentPerPerson || formData.rentPerPerson <= 0) {
        toast.error("Per-person payment is required", {
          description:
            "Please provide a valid rent amount per individual tenant.",
        });
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      // Map occupants from paxDetails + their tenant ids: an occupant with an id
      // updates that tenant; without one it's inserted (with a fresh lease).
      // Blank rows (an unfilled placeholder, or a cleared name) are dropped so we
      // neither wipe an existing tenant nor create an empty one.
      const occupants = formData.paxDetails
        .map((person, index) => ({
          id: occupantLinkage.tenantIds[index],
          tenantName: person.name?.trim() ?? "",
          email: person.email?.trim() ? person.email.trim() : null,
          contactNumber: person.phone?.trim() ?? "",
        }))
        .filter((occ) => occ.tenantName !== "");

      // A lease stores a single day-of-month (1-31). The form's richer markers
      // (weekday, bi-weekly pair, "last") have no column, so only a plain numeric
      // day persists; anything else clears it.
      const parsedDueDay = Number.parseInt(formData.dueDay, 10);
      const dueDay =
        parsedDueDay >= 1 && parsedDueDay <= 31 ? parsedDueDay : null;

      const input: UpdatePropertyInput = {
        property: {
          unitName: formData.unitName,
          propertyType: formData.propertyType || null,
          propertyLocation: formData.propertyLocation || null,
          rentAmount: formData.rentAmount,
          maxTenants: formData.maxTenants,
        },
        occupants,
        removedTenantIds: occupantLinkage.removedTenantIds,
      };

      // The lease block applies to every active lease on the property; only send
      // it when there's tenant data to anchor it to. Billing entries are derived
      // and edited per-invoice in the Edit Billing popup — never rewritten here.
      if (hasPaxData) {
        input.lease = {
          billingFrequency: formData.formBasis,
          contractPeriods: formData.contractMonths || null,
          rentStartDate: formData.rentStartDate || null,
          dueDay,
          rentAmount: formData.rentPerPerson,
        };
      }

      await api.properties.update(formData.id, input);

      const savedWhat = hasPaxData
        ? `${formData.unitName} and ${formData.pax} person detail${
            formData.pax > 1 ? "s" : ""
          } saved`
        : `${formData.unitName} updated`;

      toast.success("Property updated successfully", {
        description: savedWhat,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Error updating property:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update property";
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
          <PropertyDetailsSection
            formData={formData}
            isLocked={isLocked}
            onChange={handleChange}
          />

          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <User className="mr-2 h-4 w-4" />
              Tenant Information
            </h2>
            <Card>
              <CardContent className="p-6 space-y-4">
                <PaymentScheduleSection
                  formData={formData}
                  isLocked={isLocked}
                  onChange={handleChange}
                  onPaxNumberChange={handlePaxNumberChange}
                  onAddPerson={handleAddPerson}
                  onRemovePerson={handleRemovePerson}
                />

                <OccupantDetailsSection
                  formData={formData}
                  isLocked={isLocked}
                  editingPersonIndex={editingPersonIndex}
                  setEditingPersonIndex={setEditingPersonIndex}
                  onUpdatePersonDetail={handleUpdatePersonDetail}
                  onRemovePerson={handleRemovePerson}
                />
              </CardContent>
            </Card>
          </section>
        </div>

        <Separator className="my-4 sm:my-6" />
      </DialogContent>

      <SwitchBillingDialog
        isOpen={isSwitchConfirmOpen}
        onOpenChange={setIsSwitchConfirmOpen}
        onConfirmSwitch={() => {
          setIsSwitchConfirmOpen(false);
          onClose();
          onSwitchToBilling?.();
        }}
      />
    </Dialog>
  );
}
