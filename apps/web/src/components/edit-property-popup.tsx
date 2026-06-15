"use client";

import { useState, useEffect, useCallback } from "react";
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
import { logActivity } from "@/services/activityLogService";

// Define types
interface BillingEntry {
  id: string;
  property_id: string;
  tenant_id: string;
  period_id?: string;
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

// Per-occupant tenant linkage so the save path can map paxDetails entries back
// to specific tenants rows. tenantIds[i] is the tenant.id for paxDetails[i],
// or undefined if that occupant was added in this dialog session.
interface OccupantLinkage {
  tenantIds: (string | undefined)[];
  removedTenantIds: string[];
}

type BillingFrequency =
  | "weekly"
  | "bi-weekly"
  | "monthly"
  | "quarterly"
  | "semi-annually"
  | "annually";

interface Tenant {
  id: string;
  property_id: string | null;
  landlord_id?: string;
  tenant_name: string;
  email?: string | null;
  contact_number: string;
  tenant_slot?: number | null;
  contract_months: number | null;
  billing_frequency?: BillingFrequency;
  rent_per_person?: number;
  rent_start_date: string | null;
  due_day: string | null;
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
  max_tenants?: number | null;
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
  maxTenants: number;
  tenantId?: string;
  tenantName: string;
  contactNumber: string;
  pax: number;
  paxDetails: PersonDetail[];
  contractMonths: number;
  rentStartDate: string;
  formBasis: BillingFrequency;
  rentPerPerson: number;
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

interface EditPropertyPopupProps {
  propertyId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSwitchToBilling?: () => void;
}

const inferBillingFrequency = (
  entries: BillingEntry[] | undefined,
): BillingFrequency => {
  if (!entries || entries.length < 2) return "monthly";

  const sorted = [...entries].sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
  );
  const first = new Date(sorted[0].due_date).getTime();
  const second = new Date(sorted[1].due_date).getTime();
  const diffDays = Math.round(Math.abs(second - first) / (1000 * 60 * 60 * 24));

  if (diffDays <= 8) return "weekly";
  if (diffDays <= 16) return "bi-weekly";
  if (diffDays <= 45) return "monthly";
  if (diffDays <= 120) return "quarterly";
  if (diffDays <= 220) return "semi-annually";
  return "annually";
};

const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const isWeekDayValue = (value: string): value is (typeof WEEK_DAYS)[number] => {
  return WEEK_DAYS.includes(value as (typeof WEEK_DAYS)[number]);
};

const parseBiWeeklyDueDay = (value: string) => {
  const [firstRaw = "1", secondRaw = "16"] = value.split(",");
  const firstDay = Number.parseInt(firstRaw, 10);
  const secondDay = Number.parseInt(secondRaw, 10);

  return {
    firstDay: Number.isFinite(firstDay) ? firstDay : 1,
    secondDay: Number.isFinite(secondDay) ? secondDay : 16,
  };
};

const isValidBiWeeklyDueDayPair = (value: string): boolean => {
  const { firstDay, secondDay } = parseBiWeeklyDueDay(value);
  return firstDay >= 1 && firstDay <= 15 && secondDay >= 16 && secondDay <= 31;
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
  const [property, setProperty] = useState<Property | null>(null);
  const [formData, setFormData] = useState<PropertyFormData | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [editingPersonIndex, setEditingPersonIndex] = useState<number | null>(
    null,
  );
  const [occupantLinkage, setOccupantLinkage] = useState<OccupantLinkage>({
    tenantIds: [],
    removedTenantIds: [],
  });

  const calculatePeriodDueDate = useCallback(
    (
      startDate: Date,
      periodIndex: number,
      formBasis: BillingFrequency,
      dueDay: string,
    ): Date => {
      const base = new Date(startDate);

      if (formBasis === "weekly") {
        if (isWeekDayValue(dueDay)) {
          const dayMap: Record<(typeof WEEK_DAYS)[number], number> = {
            monday: 1,
            tuesday: 2,
            wednesday: 3,
            thursday: 4,
            friday: 5,
            saturday: 6,
            sunday: 0,
          };
          const targetDay = dayMap[dueDay];
          const currentDay = base.getDay();
          const offset = (targetDay - currentDay + 7) % 7;
          base.setDate(base.getDate() + offset + periodIndex * 7);
        } else {
          base.setDate(base.getDate() + periodIndex * 7);
        }
        return base;
      }

      if (formBasis === "bi-weekly") {
        const { firstDay, secondDay } = parseBiWeeklyDueDay(dueDay);
        const [date1, date2] = [firstDay, secondDay].sort((a, b) => a - b);
        const currentMonth = new Date(base);
        currentMonth.setDate(1);
        let useFirstDate = true;
        let useSecondDate = true;

        const firstDateInStartMonth = new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth(),
          date1,
        );
        const secondDateInStartMonth = new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth(),
          date2,
        );

        useFirstDate = firstDateInStartMonth > base;
        useSecondDate = secondDateInStartMonth > base;

        if (!useFirstDate && !useSecondDate) {
          currentMonth.setMonth(currentMonth.getMonth() + 1);
          useFirstDate = true;
          useSecondDate = true;
        }

        const generatedDates: Date[] = [];

        while (generatedDates.length <= periodIndex) {
          const year = currentMonth.getFullYear();
          const month = currentMonth.getMonth();
          const lastDay = new Date(year, month + 1, 0).getDate();

          if (useFirstDate && generatedDates.length <= periodIndex) {
            generatedDates.push(
              new Date(year, month, Math.min(date1, lastDay)),
            );
          }

          if (useSecondDate && generatedDates.length <= periodIndex) {
            generatedDates.push(
              new Date(year, month, Math.min(date2, lastDay)),
            );
          }

          currentMonth.setMonth(currentMonth.getMonth() + 1);
          useFirstDate = true;
          useSecondDate = true;
        }

        return generatedDates[periodIndex] || base;
      }

      const monthStep =
        formBasis === "quarterly"
          ? 3
          : formBasis === "semi-annually"
            ? 6
            : formBasis === "annually"
              ? 12
              : 1;

      base.setMonth(base.getMonth() + periodIndex * monthStep);
      const month = base.getMonth();

      if (dueDay === "last" || dueDay === "30th/31st - Last Day") {
        base.setMonth(month + 1, 0);
      } else if (dueDay === "1" || dueDay === "1st - First Day") {
        base.setDate(1);
      } else if (dueDay === "15" || dueDay === "15th - Mid Month") {
        base.setDate(15);
      } else {
        const dayNumber = Number.parseInt(dueDay, 10);
        if (Number.isFinite(dayNumber) && dayNumber >= 1 && dayNumber <= 31) {
          const lastDayOfMonth = new Date(
            base.getFullYear(),
            month + 1,
            0,
          ).getDate();
          base.setDate(Math.min(dayNumber, lastDayOfMonth));
        } else {
          base.setMonth(month + 1, 0);
        }
      }

      return base;
    },
    [],
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

        // Active tenants are sibling rows post-normalization, sorted by slot.
        const activeTenants = (propertyData.tenants ?? [])
          .filter((t) => t.is_active)
          .sort((a, b) => (a.tenant_slot ?? 0) - (b.tenant_slot ?? 0));

        // Person 1 (the lease anchor for legacy fields) is the first slot.
        const firstTenant = activeTenants[0];

        const initialPax = activeTenants.length || 1;

        // Build paxDetails + tenantIds in lockstep so save can map back.
        const paxDetails: PersonDetail[] =
          activeTenants.length > 0
            ? activeTenants.map((t) => ({
                name: t.tenant_name || "",
                email: t.email || "",
                phone: t.contact_number || "",
              }))
            : [{ name: "", email: "", phone: "" }];

        const tenantIds: (string | undefined)[] =
          activeTenants.length > 0
            ? activeTenants.map((t) => t.id)
            : [undefined];

        const inferredFrequency = inferBillingFrequency(
          firstTenant?.billing_entries,
        );
        const normalizedDueDay =
          firstTenant?.billing_frequency === "bi-weekly"
            ? isValidBiWeeklyDueDayPair(firstTenant?.due_day || "")
              ? firstTenant.due_day || "1,16"
              : "1,16"
            : firstTenant?.due_day || "last";

        const initialFormData: PropertyFormData = {
          id: propertyData.id,
          unitName: propertyData.unit_name,
          propertyType: propertyData.property_type,
          propertyLocation: propertyData.property_location,
          occupancyStatus: propertyData.occupancy_status,
          rentAmount: propertyData.rent_amount,
          maxTenants: propertyData.max_tenants ?? activeTenants.length ?? 1,
          tenantId: firstTenant?.id,
          tenantName: firstTenant?.tenant_name || "",
          contactNumber: firstTenant?.contact_number || "",
          pax: initialPax,
          paxDetails,
          contractMonths: firstTenant?.contract_months ?? 0,
          rentStartDate: firstTenant?.rent_start_date || "",
          formBasis: firstTenant?.billing_frequency || inferredFrequency,
          rentPerPerson:
            firstTenant?.rent_per_person !== undefined &&
            firstTenant?.rent_per_person !== null
              ? Number(firstTenant.rent_per_person)
              : initialPax > 0
                ? Number((propertyData.rent_amount / initialPax).toFixed(2))
                : propertyData.rent_amount,
          dueDay:
            normalizedDueDay === "30th/31st - Last Day"
              ? "last"
              : normalizedDueDay,
          billingSchedule: [],
        };

        setOccupantLinkage({
          tenantIds,
          removedTenantIds: [],
        });

        // Billing schedule comes off the first active tenant's rows. Edits here
        // currently only persist for that one tenant; multi-tenant fan-out is
        // tracked as a follow-up and the per-tenant edit-billing-popup handles
        // the rest.
        if (
          firstTenant?.billing_entries &&
          firstTenant.billing_entries.length > 0
        ) {
          initialFormData.billingSchedule = firstTenant.billing_entries.map(
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
          // Recalculate all dates to match configured frequency and due marker.
          const rentStartDate = initialFormData.rentStartDate
            ? new Date(initialFormData.rentStartDate)
            : new Date();

          const updatedSchedule = initialFormData.billingSchedule.map(
            (entry, index) => {
              const dueDate = calculatePeriodDueDate(
                rentStartDate,
                index,
                initialFormData.formBasis,
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
  }, [propertyId, isOpen, calculatePeriodDueDate]);

  const formatDueDate = (date: Date): string => {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    return `${monthNames[month]} ${day}, ${year}`;
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
      // Build the occupants payload from paxDetails + tenantIds. Skip blank
      // rows beyond Person 1 — those are placeholders the user never filled.
      const occupantsPayload = formData.paxDetails
        .map((person, index) => ({
          id: occupantLinkage.tenantIds[index] || undefined,
          name: person.name?.trim() ?? "",
          email: person.email?.trim() ?? "",
          phone: person.phone?.trim() ?? "",
        }))
        .filter(
          (occ, i) =>
            // Always include Person 1 (so the lease anchor stays). Skip later
            // blanks-without-id (placeholders); blanks-with-id mean an existing
            // tenant we'd be wiping — also skip and let them stand on existing
            // values (the RPC's COALESCE handles partial updates).
            i === 0 ||
            occ.id !== undefined ||
            occ.name !== "" ||
            occ.phone !== "",
        );

      // The lease block applies to every active tenant on the property.
      const leasePayload = hasPaxData
        ? {
            contract_months: formData.contractMonths || null,
            rent_start_date: formData.rentStartDate || null,
            due_day: formData.dueDay || null,
            billing_frequency: formData.formBasis,
            rent_per_person: formData.rentPerPerson,
          }
        : {};

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "update_property_atomic",
        {
          payload: {
            propertyId: formData.id,
            property: {
              unit_name: formData.unitName,
              property_type: formData.propertyType,
              property_location: formData.propertyLocation,
              rent_amount: formData.rentAmount,
              max_tenants: formData.maxTenants,
            },
            occupants: occupantsPayload,
            removedTenantIds: occupantLinkage.removedTenantIds,
            lease: leasePayload,
          },
        },
      );

      if (rpcError) throw rpcError;

      // After the RPC: if Person 1 was a fresh insert, the RPC just created the
      // row. Pick its id off the response so the billing-schedule writes below
      // can target it.
      const updatedTenants =
        (rpcData as { tenants?: Tenant[] } | null)?.tenants ?? [];
      const firstActiveTenantId =
        updatedTenants.find((t) => t.is_active)?.id ?? formData.tenantId;
      formData.tenantId = firstActiveTenantId;

      const finalOccupancyStatus = hasPaxData ? "occupied" : "vacant";

      if (formData.occupancyStatus === "occupied" || hasPaxData) {
        // Handle billing entries only for occupied properties
        if (formData.occupancyStatus === "occupied") {
          for (const entry of formData.billingSchedule) {
            // For existing entries, update them
            if (!entry.id.startsWith("temp-")) {
              const updateData: Record<string, unknown> = {
                due_date: entry.dueDate,
                status: entry.grossDue === 0 ? "Not Yet Set" : entry.status,
                other_charges: entry.otherCharges,
                rent_due: entry.rentDue,
                gross_due: entry.grossDue,
                paid_amount: entry.paidAmount || 0,
                updated_at: new Date().toISOString(),
              };

              const { error: billingError } = await supabase
                .from("billing_entries")
                .update(updateData)
                .eq("id", entry.id);

              if (billingError) throw billingError;
            }
            // For new entries, insert them
            else {
              // Calculate billing period
              // For additional charges rows (temp-additional-*), use 0
              // For regular entries, count non-additional entries up to this point
              let billingPeriod = 0;
              if (!entry.id.startsWith("temp-additional-")) {
                billingPeriod = formData.billingSchedule
                  .slice(0, formData.billingSchedule.indexOf(entry) + 1)
                  .filter((e) => !e.id.startsWith("temp-additional-")).length;
              }

              const insertData: Record<string, unknown> = {
                property_id: formData.id,
                tenant_id: formData.tenantId,
                due_date: entry.dueDate,
                rent_due: entry.rentDue,
                other_charges: entry.otherCharges,
                gross_due: entry.grossDue,
                status: entry.grossDue === 0 ? "Not Yet Set" : entry.status,
                paid_amount: entry.paidAmount || 0,
                billing_period: billingPeriod,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };

              const { error: newBillingError } = await supabase
                .from("billing_entries")
                .insert(insertData);

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

      await logActivity({
        propertyId: formData.id,
        tenantId: formData.tenantId ?? null,
        actionType: "property_updated",
        description: `Property details updated for ${formData.unitName}`,
        metadata: {
          occupancy_status: finalOccupancyStatus,
          property_type: formData.propertyType,
          billing_frequency: formData.formBasis,
          contract_periods: formData.contractMonths,
          rent_start_date: formData.rentStartDate,
          rent_per_person: formData.rentPerPerson,
          rent_amount: formData.rentAmount,
          pax: formData.pax,
          billing_entries: formData.billingSchedule.length,
        },
      });

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
        const supabaseError = err as {
          message?: string;
          error_description?: string;
          hint?: string;
        };
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
                      placeholder="e.g., Unit 101, Office 3B"
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
                        placeholder="25000"
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
                    <Label htmlFor="maxTenants">
                      Property Capacity (max tenants)
                    </Label>
                    <Input
                      id="maxTenants"
                      type="number"
                      min={1}
                      max={100}
                      value={formData.maxTenants ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/^0+(?=\d)/, "");
                        const next = parseInt(raw) || 1;
                        handleChange("maxTenants", next);
                      }}
                      disabled={isLocked}
                      className={isLocked ? "opacity-70" : ""}
                    />
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const assigned = formData.pax;
                        const cap = formData.maxTenants || 1;
                        if (assigned > cap) {
                          return `${assigned} currently assigned — over capacity (${assigned}/${cap}). Adjust capacity or remove tenants.`;
                        }
                        return `${assigned} of ${cap} slot${cap === 1 ? "" : "s"} currently assigned. Capacity is record-keeping only; you can add tenants past it.`;
                      })()}
                    </p>
                  </div>

                  <div className="space-y-2 bg-muted/20 p-3 rounded-md">
                    <p className="text-xs text-muted-foreground">
                      Property ID: {formData.id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Status auto-derived from active tenants: currently{" "}
                      <span className="font-medium capitalize">
                        {formData.pax > 0 ? "occupied" : "vacant"}
                      </span>
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
                        placeholder="1"
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contractMonths">
                      Contract Duration (Period)
                    </Label>
                    <Input
                      id="contractMonths"
                      type="number"
                      min="1"
                      value={formData.contractMonths ?? ""}
                      onChange={(e) => {
                        const value = e.target.value.replace(/^0+(?=\d)/, "");
                        handleChange("contractMonths", parseInt(value) || 0);
                      }}
                      placeholder="e.g., 12"
                      disabled={isLocked}
                      className={isLocked ? "opacity-70" : ""}
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of billing periods in the contract.
                    </p>
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
                      placeholder="Select start date"
                      disabled={isLocked}
                      className={isLocked ? "opacity-70" : ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="formBasis">Frequency Basis</Label>
                    <Select
                      value={formData.formBasis}
                      onValueChange={(value) =>
                        handleChange("formBasis", value as BillingFrequency)
                      }
                      disabled={isLocked}
                    >
                      <SelectTrigger
                        id="formBasis"
                        className={isLocked ? "opacity-70" : ""}
                      >
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="semi-annually">
                          Semi-annually
                        </SelectItem>
                        <SelectItem value="annually">Annually</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rentPerPerson">
                      Rent per Individual Tenant (per period)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5">₱</span>
                      <Input
                        id="rentPerPerson"
                        type="number"
                        className={`pl-7 ${isLocked ? "opacity-70" : ""}`}
                        value={formData.rentPerPerson ?? ""}
                        onChange={(e) => {
                          const value = e.target.value.replace(/^0+(?=\d)/, "");
                          handleChange("rentPerPerson", parseFloat(value) || 0);
                        }}
                        placeholder="Enter per-tenant amount"
                        disabled={isLocked}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total rent updates automatically based on number of
                      tenants.
                    </p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label
                      htmlFor="dueDay"
                      className="text-sm font-medium flex items-center gap-1.5"
                    >
                      <Calendar className="h-3.5 w-3.5 text-purple-600" />
                      Payment Due Marker Per Billing Period
                    </Label>

                    {formData.formBasis === "weekly" ? (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                          {WEEK_DAYS.map((day) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => handleChange("dueDay", day)}
                              disabled={isLocked}
                              className={`h-9 px-2 text-xs font-medium rounded-md border transition-all ${
                                formData.dueDay === day
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                  : "bg-background border-input hover:bg-muted"
                              } ${isLocked ? "opacity-70" : ""}`}
                            >
                              {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Select collection day of the week.
                        </p>
                      </>
                    ) : formData.formBasis === "bi-weekly" ? (
                      (() => {
                        const { firstDay, secondDay } = parseBiWeeklyDueDay(
                          formData.dueDay,
                        );

                        return (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">
                                Date 1 (1-15){" "}
                                {firstDay ? `[${firstDay}]` : "[None]"}
                              </div>
                              <div className="grid grid-cols-8 sm:grid-cols-10 lg:grid-cols-15 gap-x-1 gap-y-2 pr-12 sm:pr-16 lg:pr-24">
                                {Array.from(
                                  { length: 15 },
                                  (_, i) => i + 1,
                                ).map((date) => {
                                  const isSelected = firstDay === date;
                                  return (
                                    <button
                                      key={`bi-weekly-first-${date}`}
                                      type="button"
                                      onClick={() =>
                                        handleChange(
                                          "dueDay",
                                          `${date},${secondDay || 16}`,
                                        )
                                      }
                                      disabled={isLocked}
                                      className={`h-8 w-8 min-w-[32px] min-h-[32px] flex items-center justify-center p-0 text-xs font-medium rounded border transition-all ${
                                        isSelected
                                          ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300"
                                          : "bg-background border-input hover:bg-muted"
                                      } ${isLocked ? "opacity-70" : ""}`}
                                    >
                                      {date}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">
                                Date 2 (16-31){" "}
                                {secondDay ? `[${secondDay}]` : "[None]"}
                              </div>
                              <div className="grid grid-cols-8 sm:grid-cols-10 lg:grid-cols-16 gap-x-1 gap-y-2 pr-12 sm:pr-16 lg:pr-24">
                                {Array.from(
                                  { length: 16 },
                                  (_, i) => i + 16,
                                ).map((date) => {
                                  const isSelected = secondDay === date;
                                  return (
                                    <button
                                      key={`bi-weekly-second-${date}`}
                                      type="button"
                                      onClick={() =>
                                        handleChange(
                                          "dueDay",
                                          `${firstDay || 1},${date}`,
                                        )
                                      }
                                      disabled={isLocked}
                                      className={`h-8 w-8 min-w-[32px] min-h-[32px] flex items-center justify-center p-0 text-xs font-medium rounded border transition-all ${
                                        isSelected
                                          ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300"
                                          : "bg-background border-input hover:bg-muted"
                                      } ${isLocked ? "opacity-70" : ""}`}
                                    >
                                      {date}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <p className="text-xs text-muted-foreground">
                              Selected: Date 1 = {firstDay || "None"}, Date 2 ={" "}
                              {secondDay || "None"}.
                            </p>
                          </div>
                        );
                      })()
                    ) : (
                      <>
                        <div className="grid grid-cols-10 sm:grid-cols-15 lg:grid-cols-16 gap-x-1 gap-y-2 pr-12 sm:pr-16 lg:pr-24">
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(
                            (date) => {
                              const isSelected =
                                formData.dueDay === String(date);
                              return (
                                <button
                                  key={date}
                                  type="button"
                                  onClick={() =>
                                    handleChange("dueDay", String(date))
                                  }
                                  disabled={isLocked}
                                  className={`h-8 w-8 min-w-[32px] min-h-[32px] flex items-center justify-center p-0 text-xs font-medium rounded border transition-all ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                      : "bg-background border-input hover:bg-muted"
                                  } ${isLocked ? "opacity-70" : ""}`}
                                >
                                  {date}
                                </button>
                              );
                            },
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Selected:{" "}
                          {formData.dueDay === "last"
                            ? "Last Day"
                            : `Day ${formData.dueDay || "None"}`}{" "}
                          • Date adjusts to last day for shorter months.
                        </p>
                      </>
                    )}
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
                to &quot;Occupied&quot; above to add tenant information and
                person details.
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
