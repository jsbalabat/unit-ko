"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  User,
  Building,
  CreditCard,
  CheckCircle,
  MapPin,
  Home,
  DollarSign,
  Clock,
  X,
  AlertCircle,
  Plus,
  Trash2,
  Pencil,
  Check,
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
import { submitPropertyData } from "@/services/propertyService";
import { toast } from "sonner";
import { OtherChargesPopup } from "@/components/other-charges-popup";
import { EditIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import type {
  PropertyFormData,
  TenantInfo,
  ValidationErrors,
} from "@/components/add-property/form-types";
import {
  billableTenantCount,
  isAddingTenants as deriveIsAddingTenants,
  isValid,
  validateBillingSchedule as checkBillingSchedule,
  validateStep1 as checkStep1,
  validateStep2 as checkStep2,
  validateTenants as checkTenants,
} from "@/components/add-property/validation";
import { buildBillingSchedule } from "@/components/add-property/schedule";

// Deterministic date formatting to prevent hydration mismatches
const formatDate = (dateString: string): string => {
  if (!dateString) return "";

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

  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  return `${monthNames[month]} ${day}, ${year}`;
};

const formatMonthYear = (dateString: string): string => {
  if (!dateString) return "";

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

  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth();

  return `${monthNames[month]} ${year}`;
};

// Property Preview Component
interface PropertyPreviewProps {
  formData: PropertyFormData;
  currentStep: number;
}

function PropertyPreview({ formData, currentStep }: PropertyPreviewProps) {
  // Count only filled-in tenant entries
  const filledTenantsCount =
    formData.tenants?.filter((t) => t.tenantName && t.tenantName.trim() !== "")
      .length || 0;

  // The preview shows Occupied when the landlord is entering tenants. The saved
  // property's real occupancy comes from the server (v_property_occupancy) once
  // the lease exists.
  const isAddingTenants = deriveIsAddingTenants(formData);

  const paxCount =
    formData.maxTenants > 1
      ? filledTenantsCount > 0
        ? filledTenantsCount
        : formData.maxTenants
      : formData.tenantName
        ? 1
        : 0;

  // For pre-organized billing, rentPerCollection is per-tenant
  // For others, calculate per-person from total
  const perPersonRent =
    formData.billingType === "pre-organized" && formData.rentPerCollection > 0
      ? formData.rentPerCollection
      : formData.rentAmount && paxCount > 1
        ? Math.floor(formData.rentAmount / paxCount)
        : formData.rentAmount;

  // Total property rent
  const totalRent =
    formData.billingType === "pre-organized" &&
    formData.rentPerCollection > 0 &&
    paxCount > 0
      ? formData.rentPerCollection * paxCount
      : formData.rentAmount;

  return (
    <div className="space-y-4">
      <div className="sticky top-0 bg-muted/20 pb-2 border-b">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Live Preview
        </h3>
        <p className="text-xs text-muted-foreground">
          See how your property will look
        </p>
      </div>

      {/* Property Card Preview */}
      <Card className="shadow-md">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-base">
                {formData.unitName || "Unit Name"}
              </h4>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Building className="h-3 w-3" />
                {formData.propertyType || "Property Type"}
              </p>
            </div>
            <div
              className={cn(
                "px-2 py-1 rounded text-xs font-medium",
                isAddingTenants
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                  : "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
              )}
            >
              {isAddingTenants ? "Occupied" : "Vacant"}
            </div>
          </div>

          {formData.propertyLocation && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{formData.propertyLocation}</span>
            </div>
          )}

          <Separator />

          {/* Rent Information */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {formData.billingType === "pre-organized" && paxCount > 1
                  ? "Total Property Rent"
                  : "Monthly Rent"}
              </span>
              <div className="text-right">
                <div className="text-sm font-semibold text-green-600">
                  ₱{totalRent.toLocaleString() || "0"}/month
                </div>
                {paxCount > 1 && perPersonRent > 0 && (
                  <div className="text-xs text-muted-foreground">
                    ₱{perPersonRent.toLocaleString()} per tenant
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Occupancy Information */}
          {isAddingTenants && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Occupancy
                  </span>
                  <span className="text-xs font-medium">
                    {paxCount > 0
                      ? `${paxCount} ${paxCount === 1 ? "person" : "people"}`
                      : "No tenants"}
                  </span>
                </div>

                {formData.maxTenants === 1 ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <User className="h-3 w-3 text-blue-600" />
                      <span className="font-medium">Tenant</span>
                    </div>
                    {formData.tenantName && (
                      <p className="text-xs ml-5">{formData.tenantName}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {formData.tenants.filter((t) => t.tenantName).length > 1 ? (
                      <div className="relative group">
                        <div className="flex items-center gap-2 text-xs">
                          <User className="h-3 w-3 text-blue-600" />
                          <span className="font-medium cursor-help">
                            Multiple (
                            {
                              formData.tenants.filter((t) => t.tenantName)
                                .length
                            }
                            )
                          </span>
                        </div>
                        {/* Hover tooltip */}
                        <div className="hidden group-hover:block absolute left-0 top-full mt-2 bg-popover shadow-lg rounded-md p-3 z-50 min-w-[200px] border">
                          <div className="text-xs font-medium mb-2">
                            Tenants:
                          </div>
                          <div className="space-y-1">
                            {formData.tenants.map((tenant, idx) =>
                              tenant.tenantName ? (
                                <div key={idx} className="text-xs">
                                  {idx + 1}. {tenant.tenantName}
                                </div>
                              ) : null,
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      formData.tenants.map(
                        (tenant, idx) =>
                          tenant.tenantName && (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-xs"
                            >
                              <User className="h-3 w-3 text-blue-600" />
                              <span className="font-medium">
                                {tenant.tenantName}
                              </span>
                            </div>
                          ),
                      )
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Billing Details Preview */}
      {currentStep >= 2 && isAddingTenants && (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              Billing Setup
            </h4>

            <div className="space-y-2 text-xs">
              {formData.rentStartDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Start Date</span>
                  <span className="font-medium">
                    {formatDate(formData.rentStartDate)}
                  </span>
                </div>
              )}

              {formData.contractMonths > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">
                    {formData.contractMonths}{" "}
                    {formData.contractMonths === 1 ? "period" : "periods"}
                    {formData.formBasis && ` (${formData.formBasis})`}
                  </span>
                </div>
              )}

              {formData.billingType === "pre-organized" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Billing Template
                    </span>
                    <span className="font-medium capitalize">
                      Pre-organized
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frequency</span>
                    <span className="font-medium capitalize">
                      {formData.formBasis}
                    </span>
                  </div>
                  {formData.rentPerCollection > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Per Tenant
                        </span>
                        <span className="font-medium text-green-600">
                          ₱{formData.rentPerCollection.toLocaleString()}
                        </span>
                      </div>
                      {formData.maxTenants > 1 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Total Property
                          </span>
                          <span className="font-medium text-green-700 dark:text-green-400">
                            ₱
                            {(
                              formData.rentPerCollection *
                              (formData.tenants?.filter(
                                (t) =>
                                  t.tenantName && t.tenantName.trim() !== "",
                              ).length || formData.maxTenants)
                            ).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {formData.billingType === "blank" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Billing Template
                  </span>
                  <span className="font-medium">Blank (Custom)</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accounting Preview */}
      {currentStep >= 3 && isAddingTenants && (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-orange-600" />
              Accounting
            </h4>

            <div className="space-y-2 text-xs">
              {formData.advancePayment > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Advance Payment</span>
                  <span className="font-medium text-green-600">
                    ₱{formData.advancePayment.toLocaleString()}
                  </span>
                </div>
              )}

              {formData.securityDeposit > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Security Deposit
                  </span>
                  <span className="font-medium text-green-600">
                    ₱{formData.securityDeposit.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing Schedule Preview */}
      {currentStep === 4 && formData.billingSchedule.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-green-600" />
              Billing Schedule
            </h4>

            <div className="text-xs text-muted-foreground">
              {formData.billingSchedule.length} billing{" "}
              {formData.billingSchedule.length === 1 ? "entry" : "entries"}{" "}
              generated
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1">
              {formData.billingSchedule.slice(0, 3).map((bill, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center text-xs py-1 px-2 bg-muted/30 rounded"
                >
                  <span>{formatMonthYear(bill.dueDate)}</span>
                  <span className="font-medium">
                    ₱{bill.grossDue.toLocaleString()}
                  </span>
                </div>
              ))}
              {formData.billingSchedule.length > 3 && (
                <div className="text-center text-xs text-muted-foreground py-1">
                  +{formData.billingSchedule.length - 3} more...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface MultiStepPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: PropertyFormData) => void;
}

export function MultiStepPopup({
  isOpen,
  onClose,
  onComplete,
}: MultiStepPopupProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<PropertyFormData>({
    unitName: "",
    propertyType: "",
    tenantName: "",
    tenantEmail: "",
    contactNumber: "",
    pax: 0,
    maxTenants: 0,
    tenants: [],
    propertyLocation: "",
    billingType: "",
    contractMonths: 0,
    rentStartDate: "",
    dueDay: "",
    rentAmount: 0,
    formBasis: "",
    collectionDay: "",
    collectionDates: [],
    rentPerCollection: 0,
    advancePayment: 0,
    securityDeposit: 0,
    leaseDate: "",
    billingSchedule: [],
  });
  const [isOtherChargesPopupOpen, setIsOtherChargesPopupOpen] = useState(false);
  const [selectedBillingIndex, setSelectedBillingIndex] = useState<
    number | null
  >(null);
  const [editingRentIndex, setEditingRentIndex] = useState<number | null>(null);
  const [editingRentValue, setEditingRentValue] = useState<number>(0);
  const [editingDateIndex, setEditingDateIndex] = useState<number | null>(null);
  const [editingDateValue, setEditingDateValue] = useState<string>("");

  const isAddingTenants = deriveIsAddingTenants(formData);

  // Tenant steps (lease terms, billing) only exist when tenants are being added.
  const totalSteps = isAddingTenants ? 4 : 2;

  // Keep collectionDates/collectionDay consistent with the billing basis.
  // Adjusted during render (per React's "adjust state on prop change" guidance)
  // instead of an effect that synchronously sets state.
  const collectionDatesLength = formData.collectionDates.length;
  const [basisAnchor, setBasisAnchor] = useState({
    formBasis: formData.formBasis,
    collectionDatesLength,
    collectionDay: formData.collectionDay,
  });
  if (
    basisAnchor.formBasis !== formData.formBasis ||
    basisAnchor.collectionDatesLength !== collectionDatesLength ||
    basisAnchor.collectionDay !== formData.collectionDay
  ) {
    setBasisAnchor({
      formBasis: formData.formBasis,
      collectionDatesLength,
      collectionDay: formData.collectionDay,
    });
    if (formData.formBasis === "bi-weekly" && collectionDatesLength !== 2) {
      setFormData((prev) => ({ ...prev, collectionDates: [1, 16] }));
    } else if (formData.formBasis === "monthly" && collectionDatesLength !== 1) {
      setFormData((prev) => ({ ...prev, collectionDates: [1] }));
    } else if (formData.formBasis === "weekly" && !formData.collectionDay) {
      setFormData((prev) => ({ ...prev, collectionDay: "monday" }));
    }
  }

  // Keep the property's total rent in sync with per-collection rent × tenant
  // count. Adjusted during render (per React's "adjust state on prop change"
  // guidance) instead of an effect that synchronously sets state.
  const [rentSyncAnchor, setRentSyncAnchor] = useState({
    rentPerCollection: formData.rentPerCollection,
    isAddingTenants,
    billingType: formData.billingType,
    rentAmount: formData.rentAmount,
    maxTenants: formData.maxTenants,
    tenants: formData.tenants,
  });
  if (
    rentSyncAnchor.rentPerCollection !== formData.rentPerCollection ||
    rentSyncAnchor.isAddingTenants !== isAddingTenants ||
    rentSyncAnchor.billingType !== formData.billingType ||
    rentSyncAnchor.rentAmount !== formData.rentAmount ||
    rentSyncAnchor.maxTenants !== formData.maxTenants ||
    rentSyncAnchor.tenants !== formData.tenants
  ) {
    setRentSyncAnchor({
      rentPerCollection: formData.rentPerCollection,
      isAddingTenants,
      billingType: formData.billingType,
      rentAmount: formData.rentAmount,
      maxTenants: formData.maxTenants,
      tenants: formData.tenants,
    });
    if (
      isAddingTenants &&
      formData.billingType === "pre-organized" &&
      formData.rentPerCollection > 0
    ) {
      const totalPropertyRent =
        formData.rentPerCollection * billableTenantCount(formData);

      if (totalPropertyRent !== formData.rentAmount) {
        setFormData((prev) => ({ ...prev, rentAmount: totalPropertyRent }));
      }
    }
  }

  // Validation functions
  // The rules live in ./add-property/validation (pure, unit-tested); these
  // wrappers only bridge them to component state.
  const validateStep1 = (): boolean => {
    const newErrors = checkStep1(formData);
    setErrors(newErrors);
    return isValid(newErrors);
  };

  const validateStep2 = (): boolean => {
    const newErrors = checkStep2(formData);
    setErrors(newErrors);
    return isValid(newErrors);
  };

  const validateBillingSchedule = (): boolean => {
    const newErrors = checkBillingSchedule();
    setErrors(newErrors);
    return isValid(newErrors);
  };

  // Helper function to generate tenant fields based on maxTenants
  const handleMaxTenantsChange = (value: number) => {
    const newMaxTenants = Math.max(0, Math.min(20, value)); // Allow 0, limit max at 20

    // Generate tenant array based on new max
    const newTenants: TenantInfo[] = [];
    for (let i = 0; i < newMaxTenants; i++) {
      // Keep existing tenant data if it exists, otherwise create empty
      newTenants.push(
        formData.tenants[i] || {
          tenantName: "",
          tenantEmail: "",
          contactNumber: "",
        },
      );
    }

    setFormData({
      ...formData,
      pax: newMaxTenants, // Keep pax in sync with maxTenants
      maxTenants: newMaxTenants,
      tenants: newTenants,
    });
  };

  // Helper function to update individual tenant data
  const updateTenantData = (
    index: number,
    field: keyof TenantInfo,
    value: string | number,
  ) => {
    const newTenants = [...formData.tenants];
    newTenants[index] = {
      ...newTenants[index],
      [field]: value,
    };
    setFormData({
      ...formData,
      tenants: newTenants,
    });
  };

  // Validate all tenants for occupied bed space
  const validateTenants = (): boolean => {
    const newErrors = checkTenants(formData);
    setErrors(newErrors);
    return isValid(newErrors);
  };

  const handleOtherChargesClick = (index: number) => {
    setSelectedBillingIndex(index);
    setIsOtherChargesPopupOpen(true);
  };

  // Function to save updated other charges
  const handleSaveOtherCharges = (
    totalAmount: number,
    items: Array<{ id: string; name: string; amount: number }>,
  ) => {
    if (selectedBillingIndex === null) return;

    // Create updated billing schedule
    const updatedSchedule = [...formData.billingSchedule];
    updatedSchedule[selectedBillingIndex] = {
      ...updatedSchedule[selectedBillingIndex],
      otherCharges: totalAmount,
      grossDue: updatedSchedule[selectedBillingIndex].rentDue + totalAmount,
      expenseItems: items,
    };

    // Update form data
    setFormData({
      ...formData,
      billingSchedule: updatedSchedule,
    });

    // Close popup
    setIsOtherChargesPopupOpen(false);
    setSelectedBillingIndex(null);

    toast.success("Other charges updated", {
      description: "The billing entry has been updated with the new charges.",
    });
  };

  // Handle editing rent amount
  const handleStartEditRent = (index: number, currentRent: number) => {
    setEditingRentIndex(index);
    setEditingRentValue(currentRent);
  };

  const handleSaveRent = (index: number) => {
    if (!formData || editingRentValue < 0) return;

    const billing = formData.billingSchedule[index];
    const newGrossDue = editingRentValue + billing.otherCharges;

    const updatedSchedule = [...formData.billingSchedule];
    updatedSchedule[index] = {
      ...billing,
      rentDue: editingRentValue,
      grossDue: newGrossDue,
    };

    setFormData({ ...formData, billingSchedule: updatedSchedule });
    setEditingRentIndex(null);
    setEditingRentValue(0);

    toast.success("Rent amount updated");
  };

  const handleCancelEditRent = () => {
    setEditingRentIndex(null);
    setEditingRentValue(0);
  };

  // Handle editing due date
  const handleStartEditDate = (index: number, currentDate: string) => {
    setEditingDateIndex(index);
    setEditingDateValue(currentDate);
  };

  const handleSaveDate = (index: number) => {
    if (!formData || !editingDateValue) return;

    const updatedSchedule = [...formData.billingSchedule];
    updatedSchedule[index] = {
      ...formData.billingSchedule[index],
      dueDate: editingDateValue,
      status: calculateStatus(editingDateValue),
    };

    setFormData({ ...formData, billingSchedule: updatedSchedule });
    setEditingDateIndex(null);
    setEditingDateValue("");

    toast.success("Due date updated");
  };

  const handleCancelEditDate = () => {
    setEditingDateIndex(null);
    setEditingDateValue("");
  };

  // Helper function to calculate status based on due date
  const calculateStatus = (dueDate: string): string => {
    if (!dueDate) return "Not Yet Due";

    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return due < today ? "Overdue" : "Not Yet Due";
  };

  const handleNext = () => {
    let isValid = true;

    if (currentStep === 1) {
      isValid = validateStep1();
      // Additional validation for bed space mode with multiple tenants
      if (isValid && isAddingTenants && formData.maxTenants > 1) {
        isValid = validateTenants();
      }
    } else if (currentStep === 2 && isAddingTenants) {
      isValid = validateStep2();
    } else if (currentStep === 3 && isAddingTenants) {
      isValid = validateBillingSchedule();
    }

    if (!isValid) {
      return;
    }

    if (currentStep < totalSteps) {
      // Normal flow for all steps - no confirmation dialogs during navigation
      if (
        currentStep === 2 &&
        isAddingTenants &&
        formData.billingType === "pre-organized"
      ) {
        generateBillingSchedule();
        setCurrentStep(currentStep + 1);
      } else {
        setCurrentStep(currentStep + 1);
      }
      setErrors({}); // Clear errors when moving to next step
    }
  };

  const handleCompleteClick = () => {
    // Show confirmation dialog at the final step
    setShowConfirmation(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmation(false);
    await handleComplete(); // Actually submit the property
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({}); // Clear errors when going back
    }
  };

  const handleCancel = () => {
    setCurrentStep(1);
    setErrors({});
    setFormData({
      unitName: "",
      propertyType: "",
      tenantName: "",
      tenantEmail: "",
      contactNumber: "",
      pax: 0,
      maxTenants: 0,
      tenants: [],
      propertyLocation: "",
      contractMonths: 0,
      rentStartDate: "",
      dueDay: "",
      rentAmount: 0,
      billingType: "",
      formBasis: "",
      collectionDay: "",
      collectionDates: [],
      rentPerCollection: 0,
      advancePayment: 0,
      securityDeposit: 0,
      leaseDate: "",
      billingSchedule: [],
    });
    onClose();
  };

  // The date maths lives in ./add-property/schedule (pure, unit-tested); this
  // only surfaces the outcome and commits it to form state.
  const generateBillingSchedule = () => {
    const result = buildBillingSchedule(formData, new Date());

    if (!result.ok) {
      toast.error(result.reason);
      return;
    }

    setFormData((prev) => ({ ...prev, billingSchedule: result.periods }));

    const frequencyLabel =
      formData.formBasis.charAt(0).toUpperCase() + formData.formBasis.slice(1);
    toast.success(`${frequencyLabel} billing schedule generated`, {
      description: `${result.periods.length} billing entries created`,
    });
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const result = await submitPropertyData(formData);

      if (result.success && result.data) {
        toast.success("Property Added Successfully!", {
          description: `${formData.unitName} has been added to your portfolio.`,
        });

        onComplete(formData);

        // Close and reset form
        onClose();
        setCurrentStep(1);
        setErrors({});
        setFormData({
          unitName: "",
          propertyType: "",
          tenantName: "",
          tenantEmail: "",
          contactNumber: "",
          pax: 0,
          maxTenants: 0,
          tenants: [],
          propertyLocation: "",
          billingType: "",
          contractMonths: 0,
          rentStartDate: "",
          dueDay: "",
          rentAmount: 0,
          formBasis: "",
          collectionDay: "",
          collectionDates: [],
          rentPerCollection: 0,
          advancePayment: 0,
          securityDeposit: 0,
          leaseDate: "",
          billingSchedule: [],
        });
      } else {
        toast.error("Failed to Add Property", {
          description: result.error || "An unexpected error occurred.",
        });
      }
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Submission Error", {
        description: "Failed to submit property data. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (field: keyof PropertyFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field as keyof ValidationErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const getStepInfo = (step: number) => {
    if (!isAddingTenants) {
      switch (step) {
        case 1:
          return {
            icon: <Building className="h-5 w-5 md:h-7 md:w-7" />,
            title: "Property Details",
            description: "Basic property information and rental price",
            color: "text-blue-600 dark:text-blue-400",
            bgColor: "bg-blue-50 dark:bg-blue-950/30",
            borderColor: "border-blue-200 dark:border-blue-800",
          };
        case 2:
          return {
            icon: <CheckCircle className="h-5 w-5 md:h-7 md:w-7" />,
            title: "Complete",
            description: "Vacant property successfully added to portfolio",
            color: "text-green-600 dark:text-green-400",
            bgColor: "bg-green-50 dark:bg-green-950/30",
            borderColor: "border-green-200 dark:border-green-800",
          };
      }
    } else {
      // Original logic for occupied properties
      switch (step) {
        case 1:
          return {
            icon: <Building className="h-5 w-5 md:h-7 md:w-7" />,
            title: "Unit Details",
            description: "Basic property information and tenant details",
            color: "text-blue-600 dark:text-blue-400",
            bgColor: "bg-blue-50 dark:bg-blue-950/30",
            borderColor: "border-blue-200 dark:border-blue-800",
          };
        case 2:
          return {
            icon: <Calendar className="h-5 w-5 md:h-7 md:w-7" />,
            title: "Billing Setup",
            description: "Configure rental terms and payment schedule",
            color: "text-purple-600 dark:text-purple-400",
            bgColor: "bg-purple-50 dark:bg-purple-950/30",
            borderColor: "border-purple-200 dark:border-purple-800",
          };
        case 3:
          return {
            icon: <CreditCard className="h-5 w-5 md:h-7 md:w-7" />,
            title: "Billing Schedule",
            description:
              formData.billingType === "blank"
                ? "Create custom billing entries and set accounting details"
                : "Review and confirm generated billing table",
            color: "text-orange-600 dark:text-orange-400",
            bgColor: "bg-orange-50 dark:bg-orange-950/30",
            borderColor: "border-orange-200 dark:border-orange-800",
          };
        case 4:
          return {
            icon: <CheckCircle className="h-5 w-5 md:h-7 md:w-7" />,
            title: "Ready to Add",
            description: "Review details and add property to your portfolio",
            color: "text-green-600 dark:text-green-400",
            bgColor: "bg-green-50 dark:bg-green-950/30",
            borderColor: "border-green-200 dark:border-green-800",
          };
      }
    }

    return {
      icon: null,
      title: "",
      description: "",
      color: "",
      bgColor: "",
      borderColor: "",
    };
  };

  const stepInfo = getStepInfo(currentStep);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] sm:w-[90vw] lg:max-w-7xl !max-w-[1600px] h-[90vh] max-h-[900px] overflow-hidden flex flex-col bg-background p-0 [&>button]:hidden">
          {/* Enhanced Header - More compact and visually distinct */}
          <div
            className={`w-full ${stepInfo.bgColor} px-4 py-3 md:px-6 md:py-4`}
          >
            <DialogHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-lg md:text-2xl">
                  <div
                    className={`p-1.5 md:p-2 rounded-full bg-background/90 ${stepInfo.color} border ${stepInfo.borderColor}`}
                  >
                    {stepInfo.icon}
                  </div>
                  <span>{stepInfo.title}</span>
                </DialogTitle>
                <div className="text-right">
                  <div className="text-xs md:text-sm font-medium opacity-80">
                    Progress
                  </div>
                  <div className="text-sm md:text-base font-semibold">
                    {currentStep} of {totalSteps}
                  </div>
                </div>
              </div>
              <DialogDescription className="text-xs md:text-sm opacity-90">
                {stepInfo.description}
              </DialogDescription>
              <p className="text-xs text-muted-foreground italic">
                *Please fill out required information.
              </p>

              {/* Progress Bar - preserved colors from original */}
              <div className="relative mt-1">
                <div className="w-full bg-background/30 rounded-full h-1.5 md:h-2 shadow-inner">
                  <div
                    className={`${getProgressBarColor(
                      currentStep,
                    )} h-1.5 md:h-2 rounded-full transition-all duration-700 ease-out shadow`}
                    style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                  />
                </div>
                {/* Step indicators */}
                <div className="absolute top-0 w-full flex justify-between px-[1px]">
                  {Array.from({ length: totalSteps }, (_, i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full border transition-all duration-300 -mt-0.5 ${
                        i + 1 <= currentStep
                          ? "bg-background border-background/80 shadow"
                          : "bg-background/30 border-background/20"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Split-pane Content Area */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left Side - Form Fields */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 lg:border-r">
              {/* Validation Errors Alert - More compact */}
              {Object.keys(errors).length > 0 && (
                <Alert className="mb-4 border-destructive bg-destructive/5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">
                      Please correct the following errors:
                    </p>
                    <ul className="mt-1 list-disc list-inside text-xs">
                      {Object.entries(errors).map(([field, error]) => (
                        <li key={field}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {currentStep === 1 && (
                <div className="space-y-4">
                  <Card className="shadow-sm border">
                    <CardContent className="p-3 md:p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-950/50">
                          <Home className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-base md:text-lg font-semibold text-foreground">
                            Property Information
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Basic property details
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label
                            htmlFor="unitName"
                            className="text-sm font-medium"
                          >
                            Unit Name *
                          </Label>
                          <Input
                            id="unitName"
                            value={formData.unitName}
                            onChange={(e) =>
                              updateFormData("unitName", e.target.value)
                            }
                            placeholder="e.g., Unit 101, Office 3B"
                            className={`h-9 text-sm ${
                              errors.unitName ? "border-destructive" : ""
                            }`}
                          />
                          {errors.unitName && (
                            <p className="text-xs text-destructive">
                              {errors.unitName}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="propertyType"
                            className="text-sm font-medium"
                          >
                            Property Type *
                          </Label>
                          <Select
                            value={formData.propertyType}
                            onValueChange={(value) =>
                              updateFormData("propertyType", value)
                            }
                          >
                            <SelectTrigger
                              className={`h-9 text-sm ${
                                errors.propertyType ? "border-destructive" : ""
                              }`}
                            >
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
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
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          {errors.propertyType && (
                            <p className="text-xs text-destructive">
                              {errors.propertyType}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <Label className="text-sm font-medium mb-2 block">
                          Property Location *
                        </Label>
                        <div className="relative">
                          <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <textarea
                            value={formData.propertyLocation}
                            onChange={(e) =>
                              updateFormData("propertyLocation", e.target.value)
                            }
                            placeholder="Enter complete property address..."
                            className={`w-full h-20 pl-9 pr-3 py-2 text-sm border rounded-md focus:ring-1 resize-none ${
                              errors.propertyLocation
                                ? "border-destructive"
                                : "border-input"
                            }`}
                          />
                        </div>
                        {errors.propertyLocation && (
                          <p className="text-xs text-destructive mt-1">
                            {errors.propertyLocation}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border">
                    <CardContent className="p-3 md:p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 rounded-full bg-green-100 dark:bg-green-950/50">
                          <User className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h3 className="text-base md:text-lg font-semibold text-foreground">
                            Occupancy Details
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Current status and tenant information
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {/* Max Tenants / Bed Space Configuration */}
                        <div className="space-y-2">
                          <Label
                            htmlFor="maxTenants"
                            className="text-sm font-medium flex items-center gap-1.5"
                          >
                            Number of Tenants (Pax) *
                          </Label>
                          <Input
                            id="maxTenants"
                            type="number"
                            min="1"
                            max="20"
                            value={formData.maxTenants || ""}
                            onChange={(e) =>
                              handleMaxTenantsChange(
                                e.target.value === ""
                                  ? 0
                                  : parseInt(e.target.value) || 0,
                              )
                            }
                            placeholder="Enter number of tenants"
                            className={`h-9 text-sm ${
                              errors.maxTenants ? "border-destructive" : ""
                            }`}
                          />
                          {errors.maxTenants && (
                            <p className="text-xs text-destructive">
                              {errors.maxTenants}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Number of tenant slots/bed spaces in this property
                            (minimum 1, maximum 20)
                          </p>
                        </div>

                        <p className="text-xs text-muted-foreground -mt-2">
                          Occupancy is auto-derived from tenant entries: leave
                          this section empty to create a vacant property, or
                          fill in tenant details to mark it occupied. Capacity
                          above is record-keeping only — you can add tenants
                          past it.
                        </p>

                        {/* Never gate this on whether tenants exist — it's where
                            tenants get entered. Occupancy follows what's typed
                            here; leaving it empty is how a vacant property is
                            created. */}
                        <div className="space-y-4 pt-3 border-t border-border">
                          {/* Display mode indicator */}
                          {formData.maxTenants > 1 && (
                              <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                                <AlertCircle className="h-4 w-4 text-blue-600" />
                                <AlertDescription className="text-xs text-blue-800 dark:text-blue-300">
                                  <strong>Bed Space Mode:</strong> You can add
                                  up to {formData.maxTenants} tenants. Fill in
                                  details for occupied slots (optional for
                                  vacant slots).
                                </AlertDescription>
                              </Alert>
                            )}

                            {/* Dynamic Tenant Fields */}
                            {formData.maxTenants === 1 ? (
                              // Single Tenant Mode (Legacy)
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label
                                    htmlFor="tenantName"
                                    className="text-sm font-medium"
                                  >
                                    Tenant Name *
                                  </Label>
                                  <Input
                                    id="tenantName"
                                    value={formData.tenantName}
                                    onChange={(e) =>
                                      updateFormData(
                                        "tenantName",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Tenant's full name"
                                    className={`h-9 text-sm ${
                                      errors.tenantName
                                        ? "border-destructive"
                                        : ""
                                    }`}
                                  />
                                  {errors.tenantName && (
                                    <p className="text-xs text-destructive">
                                      {errors.tenantName}
                                    </p>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <Label
                                    htmlFor="tenantEmail"
                                    className="text-sm font-medium"
                                  >
                                    Email Address *
                                  </Label>
                                  <Input
                                    id="tenantEmail"
                                    type="email"
                                    value={formData.tenantEmail}
                                    onChange={(e) =>
                                      updateFormData(
                                        "tenantEmail",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="tenant@example.com"
                                    className={`h-9 text-sm ${
                                      errors.tenantEmail
                                        ? "border-destructive"
                                        : ""
                                    }`}
                                  />
                                  {errors.tenantEmail && (
                                    <p className="text-xs text-destructive">
                                      {errors.tenantEmail}
                                    </p>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <Label
                                    htmlFor="contactNumber"
                                    className="text-sm font-medium"
                                  >
                                    Contact Number *
                                  </Label>
                                  <Input
                                    id="contactNumber"
                                    value={formData.contactNumber}
                                    onChange={(e) =>
                                      updateFormData(
                                        "contactNumber",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="e.g., 09123456789"
                                    className={`h-9 text-sm ${
                                      errors.contactNumber
                                        ? "border-destructive"
                                        : ""
                                    }`}
                                  />
                                  {errors.contactNumber && (
                                    <p className="text-xs text-destructive">
                                      {errors.contactNumber}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              // Multiple Tenants Mode (Bed Space)
                              <div className="space-y-4">
                                {formData.tenants.map((tenant, index) => (
                                  <Card
                                    key={index}
                                    className="border-l-4 border-l-primary"
                                  >
                                    <CardContent className="p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-semibold flex items-center gap-2">
                                          <User className="h-4 w-4 text-primary" />
                                          Tenant Slot #{index + 1}
                                        </h4>
                                        <span className="text-xs text-muted-foreground">
                                          {tenant.tenantName
                                            ? "Occupied"
                                            : "Vacant"}
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                          <Label
                                            htmlFor={`tenant${index}_name`}
                                            className="text-xs font-medium"
                                          >
                                            Tenant Name
                                          </Label>
                                          <Input
                                            id={`tenant${index}_name`}
                                            value={tenant.tenantName}
                                            onChange={(e) =>
                                              updateTenantData(
                                                index,
                                                "tenantName",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="Full name"
                                            className={`h-9 text-sm ${
                                              errors[`tenant${index}_name`]
                                                ? "border-destructive"
                                                : ""
                                            }`}
                                          />
                                          {errors[`tenant${index}_name`] && (
                                            <p className="text-xs text-destructive">
                                              {errors[`tenant${index}_name`]}
                                            </p>
                                          )}
                                        </div>

                                        <div className="space-y-2">
                                          <Label
                                            htmlFor={`tenant${index}_email`}
                                            className="text-xs font-medium"
                                          >
                                            Email Address
                                          </Label>
                                          <Input
                                            id={`tenant${index}_email`}
                                            type="email"
                                            value={tenant.tenantEmail}
                                            onChange={(e) =>
                                              updateTenantData(
                                                index,
                                                "tenantEmail",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="email@example.com"
                                            className={`h-9 text-sm ${
                                              errors[`tenant${index}_email`]
                                                ? "border-destructive"
                                                : ""
                                            }`}
                                          />
                                          {errors[`tenant${index}_email`] && (
                                            <p className="text-xs text-destructive">
                                              {errors[`tenant${index}_email`]}
                                            </p>
                                          )}
                                        </div>

                                        <div className="space-y-2">
                                          <Label
                                            htmlFor={`tenant${index}_contact`}
                                            className="text-xs font-medium"
                                          >
                                            Contact Number
                                          </Label>
                                          <Input
                                            id={`tenant${index}_contact`}
                                            value={tenant.contactNumber}
                                            onChange={(e) =>
                                              updateTenantData(
                                                index,
                                                "contactNumber",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="09XXXXXXXXX"
                                            className={`h-9 text-sm ${
                                              errors[`tenant${index}_contact`]
                                                ? "border-destructive"
                                                : ""
                                            }`}
                                          />
                                          {errors[`tenant${index}_contact`] && (
                                            <p className="text-xs text-destructive">
                                              {errors[`tenant${index}_contact`]}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                        </div>

                        {!isAddingTenants && (
                          <div className="pt-3 border-t border-border">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label
                                  htmlFor="vacantRentAmount"
                                  className="text-sm font-medium flex items-center gap-1.5"
                                >
                                  Expected Monthly Rent (₱) *
                                </Label>
                              </div>
                              <Input
                                id="vacantRentAmount"
                                type="number"
                                value={formData.rentAmount || ""}
                                onChange={(e) =>
                                  updateFormData(
                                    "rentAmount",
                                    e.target.value === ""
                                      ? 0
                                      : parseInt(e.target.value) || 0,
                                  )
                                }
                                placeholder="25000"
                                className={`h-9 text-sm ${
                                  errors.rentAmount ? "border-destructive" : ""
                                }`}
                              />
                              {errors.rentAmount && (
                                <p className="text-xs text-destructive">
                                  {errors.rentAmount}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                No tenants added — this property will be saved
                                as vacant. Enter expected monthly rent for the
                                listing.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Step 2: Billing Setup - More compact */}
              {currentStep === 2 && isAddingTenants && (
                <div className="space-y-4">
                  <div className="bg-purple-50/50 dark:bg-purple-950/20 p-2 rounded-lg border border-purple-100 dark:border-purple-900/50 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="p-1 rounded-full bg-purple-100 dark:bg-purple-900/50">
                        <Calendar className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
                        Setting up billing for{" "}
                        <span className="font-semibold">
                          {formData.unitName}
                        </span>
                      </p>
                    </div>
                  </div>

                  <Card className="shadow-sm border">
                    <CardContent className="p-3 md:p-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                          <Label className="text-sm font-medium">
                            Billing Template *
                          </Label>
                          <div className="grid grid-cols-2 gap-2 max-w-sm">
                            <button
                              type="button"
                              onClick={() =>
                                updateFormData("billingType", "pre-organized")
                              }
                              className={cn(
                                "h-9 px-3 text-sm font-medium rounded-md border transition-all",
                                formData.billingType === "pre-organized"
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                  : "bg-background border-input hover:bg-muted",
                              )}
                            >
                              Pre-organized
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateFormData("billingType", "blank")
                              }
                              className={cn(
                                "h-9 px-3 text-sm font-medium rounded-md border transition-all",
                                formData.billingType === "blank"
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                  : "bg-background border-input hover:bg-muted",
                              )}
                            >
                              Blank
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Choose billing structure type
                          </p>
                        </div>

                        {/* Pre-organized Billing Fields */}
                        {formData.billingType === "pre-organized" && (
                          <>
                            <div className="space-y-2">
                              <Label
                                htmlFor="contractMonths"
                                className="text-sm font-medium flex items-center gap-1.5"
                              >
                                <Clock className="h-3.5 w-3.5 text-purple-600" />
                                Contract Duration (Period) *
                              </Label>
                              <Input
                                id="contractMonths"
                                type="number"
                                min="1"
                                max="100"
                                value={formData.contractMonths || ""}
                                onChange={(e) =>
                                  updateFormData(
                                    "contractMonths",
                                    e.target.value === ""
                                      ? 0
                                      : parseInt(e.target.value) || 0,
                                  )
                                }
                                placeholder="e.g., 12"
                                className={`h-9 text-sm ${
                                  errors.contractMonths
                                    ? "border-destructive"
                                    : ""
                                }`}
                              />
                              {errors.contractMonths && (
                                <p className="text-xs text-destructive">
                                  {errors.contractMonths}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Number of billing periods based on frequency
                                below (e.g., 12 monthly periods = 1 year)
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label
                                htmlFor="rentStartDate"
                                className="text-sm font-medium flex items-center gap-1.5"
                              >
                                <Calendar className="h-3.5 w-3.5 text-purple-600" />
                                Start Rent Date *
                              </Label>
                              <Input
                                id="rentStartDate"
                                type="date"
                                value={formData.rentStartDate}
                                onChange={(e) =>
                                  updateFormData(
                                    "rentStartDate",
                                    e.target.value,
                                  )
                                }
                                placeholder="Select start date"
                                className={`h-9 text-sm ${
                                  errors.rentStartDate
                                    ? "border-destructive"
                                    : ""
                                }`}
                              />
                              {errors.rentStartDate && (
                                <p className="text-xs text-destructive">
                                  {errors.rentStartDate}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                When rent collection begins
                              </p>
                            </div>

                            <div className="space-y-2 md:col-span-2">
                              <Label className="text-sm font-medium flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-purple-600" />
                                Frequency Basis *
                              </Label>
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                {[
                                  "weekly",
                                  "bi-weekly",
                                  "monthly",
                                  "quarterly",
                                  "semi-annually",
                                  "annually",
                                ].map((basis) => (
                                  <button
                                    key={basis}
                                    type="button"
                                    onClick={() =>
                                      updateFormData("formBasis", basis)
                                    }
                                    className={cn(
                                      "h-9 px-2 text-xs font-medium rounded-md border transition-all",
                                      formData.formBasis === basis
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : "bg-background border-input hover:bg-muted",
                                    )}
                                  >
                                    {basis.charAt(0).toUpperCase() +
                                      basis.slice(1)}
                                  </button>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Select billing frequency
                              </p>
                            </div>

                            {/* Collection Day/Date Fields */}
                            {formData.formBasis === "weekly" && (
                              <div className="space-y-2 md:col-span-2">
                                <Label className="text-sm font-medium flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5 text-purple-600" />
                                  Collection Day *
                                </Label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                                  {[
                                    "monday",
                                    "tuesday",
                                    "wednesday",
                                    "thursday",
                                    "friday",
                                    "saturday",
                                    "sunday",
                                  ].map((day) => (
                                    <button
                                      key={day}
                                      type="button"
                                      onClick={() =>
                                        updateFormData("collectionDay", day)
                                      }
                                      className={cn(
                                        "h-9 px-2 text-xs font-medium rounded-md border transition-all",
                                        formData.collectionDay === day
                                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                          : "bg-background border-input hover:bg-muted",
                                      )}
                                    >
                                      {day.charAt(0).toUpperCase() +
                                        day.slice(1, 3)}
                                    </button>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Which day of the week to collect rent
                                </p>
                              </div>
                            )}

                            {formData.formBasis === "bi-weekly" && (
                              <div className="space-y-4 md:col-span-2">
                                <Label className="text-sm font-medium flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5 text-purple-600" />
                                  Collection Dates (Select 2 dates per month) *
                                </Label>

                                {/* Day 1 (1-15) */}
                                <div className="space-y-2">
                                  <div className="text-xs font-medium text-muted-foreground">
                                    Day 1 (1-15){" "}
                                    {formData.collectionDates[0]
                                      ? `[${formData.collectionDates[0]}]`
                                      : "[None]"}
                                  </div>
                                  <div className="grid grid-cols-10 sm:grid-cols-15 lg:grid-cols-16 gap-x-1 gap-y-2 pr-12 sm:pr-16 lg:pr-24">
                                    {Array.from(
                                      { length: 15 },
                                      (_, i) => i + 1,
                                    ).map((date) => {
                                      const isSelected =
                                        formData.collectionDates[0] === date;
                                      return (
                                        <button
                                          key={date}
                                          type="button"
                                          onClick={() => {
                                            const newDates = [
                                              ...formData.collectionDates,
                                            ];
                                            newDates[0] = date;
                                            // Ensure we always have 2 elements
                                            if (newDates.length === 1) {
                                              newDates.push(16);
                                            }
                                            updateFormData(
                                              "collectionDates",
                                              newDates,
                                            );
                                          }}
                                          className={cn(
                                            "h-8 w-8 min-w-[32px] min-h-[32px] flex items-center justify-center p-0 text-xs font-medium rounded border transition-all",
                                            isSelected
                                              ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300"
                                              : "bg-background border-input hover:bg-muted",
                                          )}
                                        >
                                          {date}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Day 2 (16-31) */}
                                <div className="space-y-2">
                                  <div className="text-xs font-medium text-muted-foreground">
                                    Day 2 (16-31){" "}
                                    {formData.collectionDates[1]
                                      ? `[${formData.collectionDates[1]}]`
                                      : "[None]"}
                                  </div>
                                  <div className="grid grid-cols-10 sm:grid-cols-15 lg:grid-cols-16 gap-x-1 gap-y-2 pr-12 sm:pr-16 lg:pr-24">
                                    {Array.from(
                                      { length: 16 },
                                      (_, i) => i + 16,
                                    ).map((date) => {
                                      const isSelected =
                                        formData.collectionDates[1] === date;
                                      return (
                                        <button
                                          key={date}
                                          type="button"
                                          onClick={() => {
                                            const newDates = [
                                              ...formData.collectionDates,
                                            ];
                                            newDates[1] = date;
                                            // Ensure we always have 2 elements
                                            if (newDates.length < 2) {
                                              newDates[0] = newDates[0] || 1;
                                            }
                                            updateFormData(
                                              "collectionDates",
                                              newDates,
                                            );
                                          }}
                                          className={cn(
                                            "h-8 w-8 min-w-[32px] min-h-[32px] flex items-center justify-center p-0 text-xs font-medium rounded border transition-all",
                                            isSelected
                                              ? "bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-300"
                                              : "bg-background border-input hover:bg-muted",
                                          )}
                                        >
                                          {date}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <p className="text-xs text-muted-foreground">
                                  Selected: Day 1 ={" "}
                                  {formData.collectionDates[0] || "None"}, Day 2
                                  = {formData.collectionDates[1] || "None"} •
                                  Dates adjust to last day for shorter months
                                </p>
                              </div>
                            )}

                            {formData.formBasis === "monthly" && (
                              <div className="space-y-2 md:col-span-2">
                                <Label className="text-sm font-medium flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5 text-purple-600" />
                                  Collection Date (Day of Month) *
                                </Label>
                                <div className="grid grid-cols-10 sm:grid-cols-15 lg:grid-cols-16 gap-x-1 gap-y-2 pr-12 sm:pr-16 lg:pr-24">
                                  {Array.from(
                                    { length: 31 },
                                    (_, i) => i + 1,
                                  ).map((date) => {
                                    const isSelected =
                                      formData.collectionDates[0] === date;
                                    return (
                                      <button
                                        key={date}
                                        type="button"
                                        onClick={() => {
                                          updateFormData("collectionDates", [
                                            date,
                                          ]);
                                        }}
                                        className={cn(
                                          "h-8 w-8 min-w-[32px] min-h-[32px] flex items-center justify-center p-0 text-xs font-medium rounded border transition-all",
                                          isSelected
                                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                            : "bg-background border-input hover:bg-muted",
                                        )}
                                      >
                                        {date}
                                      </button>
                                    );
                                  })}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Selected: Day{" "}
                                  {formData.collectionDates[0] || "None"} • Date
                                  adjusts to last day for shorter months
                                </p>
                              </div>
                            )}

                            {[
                              "quarterly",
                              "semi-annually",
                              "annually",
                            ].includes(formData.formBasis) && (
                              <div className="space-y-2 md:col-span-2">
                                <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/50">
                                  <p className="text-sm text-blue-800 dark:text-blue-300">
                                    <strong>Collection Date:</strong> Based on
                                    Start Rent Date
                                  </p>
                                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    {formData.formBasis === "quarterly" &&
                                      "Every 3 months from start date"}
                                    {formData.formBasis === "semi-annually" &&
                                      "Every 6 months from start date"}
                                    {formData.formBasis === "annually" &&
                                      "Every 12 months from start date"}
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="space-y-2 md:col-span-2">
                              <Label
                                htmlFor="rentPerCollection"
                                className="text-sm font-medium flex items-center gap-1.5"
                              >
                                <DollarSign className="h-3.5 w-3.5 text-green-600" />
                                Rent per Individual Tenant (₱) *
                              </Label>
                              <Input
                                id="rentPerCollection"
                                type="number"
                                min="0"
                                value={formData.rentPerCollection || ""}
                                onChange={(e) =>
                                  updateFormData(
                                    "rentPerCollection",
                                    e.target.value === ""
                                      ? 0
                                      : parseInt(e.target.value) || 0,
                                  )
                                }
                                placeholder="Enter per-tenant amount"
                                className="h-9 text-sm"
                              />
                              <p className="text-xs text-muted-foreground">
                                {formData.maxTenants > 1
                                  ? `Amount per tenant on each ${formData.formBasis} rent date. Total property rent will be calculated automatically.`
                                  : `Amount to collect on each ${formData.formBasis} rent date`}
                              </p>
                            </div>
                          </>
                        )}

                        {/* Blank Billing - Only Start Rent Date */}
                        {formData.billingType === "blank" && (
                          <div className="space-y-2 md:col-span-2">
                            <Label
                              htmlFor="rentStartDate"
                              className="text-sm font-medium flex items-center gap-1.5"
                            >
                              <Calendar className="h-3.5 w-3.5 text-purple-600" />
                              Start Rent Date *
                            </Label>
                            <Input
                              id="rentStartDate"
                              type="date"
                              value={formData.rentStartDate}
                              onChange={(e) =>
                                updateFormData("rentStartDate", e.target.value)
                              }
                              placeholder="Select start date"
                              className={`h-9 text-sm max-w-xs ${
                                errors.rentStartDate ? "border-destructive" : ""
                              }`}
                            />
                            {errors.rentStartDate && (
                              <p className="text-xs text-destructive">
                                {errors.rentStartDate}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              When rent collection begins. Billing schedule will
                              be managed manually.
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Preview Panel - Only for Pre-organized */}
                  {formData.billingType === "pre-organized" &&
                    formData.rentStartDate && (
                      <Card className="bg-muted/20 border-dashed">
                        <CardContent className="p-3 md:p-5">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium">
                              Collection Schedule Preview
                            </h3>
                            <div className="text-xs text-muted-foreground">
                              {formData.formBasis.charAt(0).toUpperCase() +
                                formData.formBasis.slice(1)}{" "}
                              basis
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">
                                Frequency:
                              </span>
                              <span className="font-medium">
                                {formData.formBasis.charAt(0).toUpperCase() +
                                  formData.formBasis.slice(1)}
                              </span>
                            </div>
                            {formData.formBasis === "weekly" && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">
                                  Collection Day:
                                </span>
                                <span className="font-medium">
                                  {formData.collectionDay
                                    .charAt(0)
                                    .toUpperCase() +
                                    formData.collectionDay.slice(1)}
                                </span>
                              </div>
                            )}
                            {formData.formBasis === "bi-weekly" && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">
                                  Collection Dates:
                                </span>
                                <span className="font-medium">
                                  Day {formData.collectionDates[0]} &{" "}
                                  {formData.collectionDates[1]}
                                </span>
                              </div>
                            )}
                            {formData.formBasis === "monthly" && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">
                                  Collection Date:
                                </span>
                                <span className="font-medium">
                                  Day {formData.collectionDates[0]} of month
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between text-xs border-t pt-2">
                              <span className="text-muted-foreground">
                                Amount per Collection:
                              </span>
                              <span className="font-semibold text-green-600">
                                ₱{formData.rentPerCollection.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                </div>
              )}

              {/* Step 3: Billing Schedule Table - Better compact design */}
              {currentStep === 3 && isAddingTenants && (
                <div className="space-y-4">
                  <div className="bg-orange-50/50 dark:bg-orange-950/20 rounded-lg border border-orange-100 dark:border-orange-900/50 p-2">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="p-1 rounded-full bg-orange-100 dark:bg-orange-900/50">
                        <CreditCard className="h-3.5 w-3.5 text-orange-600" />
                      </div>
                      <div className="text-sm font-medium text-orange-800 dark:text-orange-300">
                        {formData.billingType === "blank" ? "Create" : "Review"}{" "}
                        billing schedule for{" "}
                        <span className="font-semibold">
                          {formData.tenantName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Accounting & Monitoring Section */}
                  <Card className="shadow-sm border">
                    <CardContent className="p-3 md:p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div>
                          <h3 className="text-base md:text-lg font-semibold text-foreground">
                            Accounting & Deposits
                          </h3>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label
                            htmlFor="advancePayment"
                            className="text-sm font-medium flex items-center gap-1.5"
                          >
                            Advance Payment (₱)
                          </Label>
                          <Input
                            id="advancePayment"
                            type="number"
                            min="0"
                            value={formData.advancePayment || ""}
                            onChange={(e) =>
                              updateFormData(
                                "advancePayment",
                                e.target.value === ""
                                  ? 0
                                  : parseInt(e.target.value) || 0,
                              )
                            }
                            placeholder="Enter advance payment amount"
                            className="h-9 text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Advance rent payment (affects billing status)
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor="securityDeposit"
                            className="text-sm font-medium flex items-center gap-1.5"
                          >
                            Security Deposit (₱)
                          </Label>
                          <Input
                            id="securityDeposit"
                            type="number"
                            min="0"
                            value={formData.securityDeposit || ""}
                            onChange={(e) =>
                              updateFormData(
                                "securityDeposit",
                                e.target.value === ""
                                  ? 0
                                  : parseInt(e.target.value) || 0,
                              )
                            }
                            placeholder="Enter security deposit amount"
                            className="h-9 text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Refundable security deposit amount
                          </p>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label
                            htmlFor="leaseDate"
                            className="text-sm font-medium flex items-center gap-1.5"
                          >
                            <Calendar className="h-3.5 w-3.5 text-blue-600" />
                            Lease/Contract Date Expiry (Optional)
                          </Label>
                          <Input
                            id="leaseDate"
                            type="date"
                            value={formData.leaseDate}
                            onChange={(e) =>
                              updateFormData("leaseDate", e.target.value)
                            }
                            placeholder="Select lease/contract date"
                            className="h-9 text-sm max-w-xs"
                          />
                          <p className="text-xs text-muted-foreground">
                            Date when the lease/contract expires (optional)
                          </p>
                        </div>

                        {/* Summary Display */}
                        {(formData.advancePayment > 0 ||
                          formData.securityDeposit > 0) && (
                          <div className="md:col-span-2 mt-2">
                            <div className="bg-green-50/50 dark:bg-green-950/20 p-3 rounded-lg border border-green-200 dark:border-green-900">
                              <h4 className="text-xs font-semibold text-green-800 dark:text-green-300 mb-2">
                                Financial Summary
                              </h4>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">
                                    Advance Payment:
                                  </span>
                                  <span className="font-medium ml-2 text-green-600">
                                    ₱{formData.advancePayment.toLocaleString()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">
                                    Security Deposit:
                                  </span>
                                  <span className="font-medium ml-2 text-green-600">
                                    ₱{formData.securityDeposit.toLocaleString()}
                                  </span>
                                </div>
                                <div className="col-span-2 pt-2 border-t border-green-200 dark:border-green-800">
                                  <span className="text-muted-foreground">
                                    Total Collected:
                                  </span>
                                  <span className="font-semibold ml-2 text-green-700 dark:text-green-400">
                                    ₱
                                    {(
                                      formData.advancePayment +
                                      formData.securityDeposit
                                    ).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border overflow-hidden">
                    <CardContent className="p-3 md:p-5 pb-0">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-full bg-orange-100 dark:bg-orange-950/50">
                            <CreditCard className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div>
                            <h3 className="text-base md:text-lg font-semibold text-foreground">
                              {formData.billingType === "blank"
                                ? "Custom Billing Schedule"
                                : "Billing Schedule"}
                            </h3>
                            {formData.billingType === "blank" && (
                              <p className="text-xs text-muted-foreground">
                                Add and customize billing entries as needed
                              </p>
                            )}
                          </div>
                        </div>
                        {formData.billingType === "blank" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const newEntry = {
                                dueDate: "",
                                rentDue: 0,
                                otherCharges: 0,
                                grossDue: 0,
                                status: "Not Yet Due",
                                expenseItems: [],
                              };
                              setFormData((prev) => ({
                                ...prev,
                                billingSchedule: [
                                  ...prev.billingSchedule,
                                  newEntry,
                                ],
                              }));
                            }}
                            className="text-xs"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add Entry
                          </Button>
                        )}
                      </div>
                    </CardContent>

                    {/* Mobile: Stack layout, Desktop: Table layout */}
                    <div className="block sm:hidden">
                      {/* Mobile Card Layout */}
                      {formData.billingSchedule.length === 0 &&
                      formData.billingType === "blank" ? (
                        <div className="p-8 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <Calendar className="h-8 w-8 opacity-50" />
                            <p className="text-sm">No billing entries yet</p>
                            <p className="text-xs">
                              Tap &quot;Add Entry&quot; to create custom billing
                              periods
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="divide-y">
                          {formData.billingSchedule.map((bill, index) => (
                            <div key={index} className="p-3">
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="text-xs font-medium">
                                  {index + 1}
                                </h4>
                                {formData.billingType === "blank" ? (
                                  <div className="flex gap-2 items-center">
                                    <Input
                                      type="date"
                                      value={bill.dueDate}
                                      onChange={(e) => {
                                        const updated = [
                                          ...formData.billingSchedule,
                                        ];
                                        updated[index].dueDate = e.target.value;
                                        updated[index].status = calculateStatus(
                                          e.target.value,
                                        );
                                        setFormData({
                                          ...formData,
                                          billingSchedule: updated,
                                        });
                                      }}
                                      className="h-6 text-xs w-28"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const updated =
                                          formData.billingSchedule.filter(
                                            (_, i) => i !== index,
                                          );
                                        setFormData({
                                          ...formData,
                                          billingSchedule: updated,
                                        });
                                      }}
                                      disabled={
                                        index !==
                                        formData.billingSchedule.length - 1
                                      }
                                      className="h-6 px-2 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full">
                                    {bill.dueDate}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <div className="text-muted-foreground">
                                    Rent
                                  </div>
                                  {formData.billingType === "blank" ? (
                                    <Input
                                      type="number"
                                      min="0"
                                      value={bill.rentDue}
                                      onChange={(e) => {
                                        const updated = [
                                          ...formData.billingSchedule,
                                        ];
                                        const rentDue =
                                          parseInt(e.target.value) || 0;
                                        updated[index].rentDue = rentDue;
                                        updated[index].grossDue =
                                          rentDue + updated[index].otherCharges;
                                        setFormData({
                                          ...formData,
                                          billingSchedule: updated,
                                        });
                                      }}
                                      className="h-6 text-xs font-medium text-green-600"
                                      placeholder="Rent"
                                    />
                                  ) : (
                                    <div className="font-medium text-green-600">
                                      ₱{bill.rentDue.toLocaleString()}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="text-muted-foreground">
                                    Other Charges
                                  </div>
                                  <button
                                    onClick={() =>
                                      handleOtherChargesClick(index)
                                    }
                                    className="flex items-center gap-1 text-blue-600 font-medium"
                                  >
                                    ₱{bill.otherCharges.toLocaleString()}
                                    <EditIcon className="h-3 w-3" />
                                  </button>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">
                                    Total
                                  </div>
                                  <div className="font-bold">
                                    ₱{bill.grossDue.toLocaleString()}
                                  </div>
                                </div>
                                <div className="col-span-2">
                                  <div className="text-muted-foreground">
                                    Status
                                  </div>
                                  <span
                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                      bill.status.toLowerCase() === "paid"
                                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                        : bill.status.toLowerCase() ===
                                            "partial"
                                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                          : bill.status.toLowerCase() ===
                                              "overdue"
                                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                            : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                                    }`}
                                  >
                                    {bill.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Desktop Table Layout */}
                    <div className="hidden sm:block">
                      <div className="w-full border rounded-lg overflow-hidden">
                        <table className="w-full table-auto border-collapse">
                          <thead className="bg-muted/50">
                            <tr className="text-left border-b">
                              <th className="px-3 py-3 text-xs font-semibold text-muted-foreground w-12">
                                Period
                              </th>
                              <th className="px-3 py-3 text-xs font-semibold text-muted-foreground w-30">
                                Due Date
                              </th>
                              <th className="px-3 py-3 text-xs font-semibold text-muted-foreground text-center w-24">
                                Rent
                              </th>
                              <th className="px-3 py-3 text-xs font-semibold text-muted-foreground text-center w-32">
                                Other
                              </th>
                              <th className="px-3 py-3 text-xs font-semibold text-muted-foreground text-right w-24">
                                Total
                              </th>
                              <th className="px-3 py-3 text-xs font-semibold text-muted-foreground w-28">
                                Status
                              </th>
                              {formData.billingType === "blank" && (
                                <th className="px-3 py-3 text-xs font-semibold text-muted-foreground text-center w-20">
                                  Action
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {formData.billingSchedule.length === 0 &&
                            formData.billingType === "blank" ? (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="p-8 text-center text-muted-foreground"
                                >
                                  <div className="flex flex-col items-center gap-2">
                                    <Calendar className="h-8 w-8 opacity-50" />
                                    <p className="text-sm">
                                      No billing entries yet
                                    </p>
                                    <p className="text-xs">
                                      Click &quot;Add Entry&quot; to create
                                      custom billing periods
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              formData.billingSchedule.map((bill, index) => (
                                <tr key={index} className="hover:bg-muted/30">
                                  <td className="px-3 py-3 text-sm font-medium">
                                    {index + 1}
                                  </td>
                                  <td className="px-3 py-3 text-sm">
                                    {formData.billingType === "blank" ? (
                                      editingDateIndex === index ? (
                                        <div className="flex items-center gap-1">
                                          <Input
                                            type="date"
                                            value={editingDateValue}
                                            onChange={(e) =>
                                              setEditingDateValue(
                                                e.target.value,
                                              )
                                            }
                                            className="h-8 w-38 text-sm"
                                            autoFocus
                                          />
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                            onClick={() =>
                                              handleSaveDate(index)
                                            }
                                          >
                                            <Check className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={handleCancelEditDate}
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2 group">
                                          <span>
                                            {bill.dueDate
                                              ? formatDate(bill.dueDate)
                                              : "Not set"}
                                          </span>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() =>
                                              handleStartEditDate(
                                                index,
                                                bill.dueDate,
                                              )
                                            }
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      )
                                    ) : (
                                      <span>{formatDate(bill.dueDate)}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-sm text-right font-medium">
                                    {formData.billingType === "blank" ? (
                                      editingRentIndex === index ? (
                                        <div className="flex items-center justify-end gap-1">
                                          <Input
                                            type="number"
                                            value={editingRentValue}
                                            onChange={(e) =>
                                              setEditingRentValue(
                                                parseInt(e.target.value) || 0,
                                              )
                                            }
                                            className="h-8 w-28 text-right text-sm"
                                            min="0"
                                            autoFocus
                                          />
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                            onClick={() =>
                                              handleSaveRent(index)
                                            }
                                          >
                                            <Check className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={handleCancelEditRent}
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-end gap-2 group">
                                          <span>
                                            ₱{bill.rentDue.toLocaleString()}
                                          </span>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() =>
                                              handleStartEditRent(
                                                index,
                                                bill.rentDue,
                                              )
                                            }
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      )
                                    ) : (
                                      <span>
                                        ₱{bill.rentDue.toLocaleString()}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        handleOtherChargesClick(index)
                                      }
                                      className="text-xs h-8 px-3 mx-auto hover:bg-accent"
                                    >
                                      {bill.otherCharges > 0
                                        ? `₱${bill.otherCharges.toLocaleString()}`
                                        : "+"}
                                    </Button>
                                  </td>
                                  <td className="px-3 py-3 text-sm font-semibold text-right">
                                    ₱{bill.grossDue.toLocaleString()}
                                  </td>
                                  <td className="px-3 py-3">
                                    <span
                                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                        bill.status.toLowerCase() === "paid"
                                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                          : bill.status.toLowerCase() ===
                                              "partial"
                                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                            : bill.status.toLowerCase() ===
                                                "overdue"
                                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                              : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                                      }`}
                                    >
                                      {bill.status}
                                    </span>
                                  </td>
                                  {formData.billingType === "blank" && (
                                    <td className="px-3 py-3 text-center">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const updated =
                                            formData.billingSchedule.filter(
                                              (_, i) => i !== index,
                                            );
                                          setFormData({
                                            ...formData,
                                            billingSchedule: updated,
                                          });
                                        }}
                                        disabled={
                                          index !==
                                          formData.billingSchedule.length - 1
                                        }
                                        className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </td>
                                  )}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Summary Bar */}
                    <div className="bg-muted/20 p-3 border-t flex items-center justify-between">
                      <div className="text-xs flex gap-3">
                        <div>
                          <span className="text-muted-foreground">
                            Periods:
                          </span>{" "}
                          <span className="font-medium">
                            {formData.billingSchedule.length}
                          </span>
                        </div>
                        {formData.billingType !== "blank" && (
                          <div>
                            <span className="text-muted-foreground">
                              Monthly:
                            </span>{" "}
                            <span className="font-medium text-green-600">
                              ₱{formData.rentAmount.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground">
                          Total Contract Value:
                        </span>{" "}
                        <span className="font-bold">
                          ₱
                          {formData.billingSchedule
                            .reduce((sum, bill) => sum + bill.grossDue, 0)
                            .toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Step 4: Completion - More polished */}
              {currentStep === totalSteps && (
                <div className="text-center space-y-4">
                  <div className="relative inline-flex mx-auto">
                    <div className="absolute inset-0 bg-green-200 dark:bg-green-900/30 rounded-full blur-xl opacity-70"></div>
                    <div className="relative bg-gradient-to-br from-green-100 to-green-50 dark:from-green-900/70 dark:to-green-800/50 p-4 rounded-full">
                      <CheckCircle className="h-12 w-12 md:h-16 md:w-16 text-green-600 dark:text-green-400" />
                    </div>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-green-600 dark:text-green-400 mb-1">
                      Ready to Add Property
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Your new property will be added to your portfolio
                    </p>
                  </div>

                  <Card className="max-w-sm mx-auto shadow-sm border mt-2">
                    <CardContent className="p-3 md:p-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">
                            Property
                          </span>
                          <span className="text-sm font-medium">
                            {formData.unitName}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">
                            Type
                          </span>
                          <span className="text-sm">
                            {formData.propertyType}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">
                            Status
                          </span>
                          <span className="text-sm font-medium capitalize">
                            {!isAddingTenants ? (
                              <span className="text-orange-600">Available</span>
                            ) : (
                              <span className="text-blue-600">Occupied</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">
                            Rent
                          </span>
                          <span className="text-sm font-medium text-green-600">
                            ₱{formData.rentAmount.toLocaleString()}
                          </span>
                        </div>

                        {isAddingTenants && (
                          <>
                            <Separator />
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">
                                Tenant
                              </span>
                              <span className="text-sm">
                                {formData.tenantName}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">
                                Duration
                              </span>
                              <span className="text-sm">
                                {formData.contractMonths}{" "}
                                {formData.contractMonths === 1
                                  ? "period"
                                  : "periods"}
                                {formData.formBasis &&
                                  ` (${formData.formBasis})`}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* Right Side - Live Preview */}
            <div className="hidden lg:block w-96 overflow-y-auto px-4 py-4 bg-muted/20">
              <PropertyPreview formData={formData} currentStep={currentStep} />
            </div>
          </div>

          {/* Navigation Bar - More compact and visually appealing */}
          <div className="border-t bg-muted/10 p-3 flex items-center justify-between">
            {/* Left Button */}
            {currentStep === 1 ? (
              <Button
                variant="ghost"
                onClick={handleCancel}
                size="sm"
                className="text-xs"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={handlePrevious}
                size="sm"
                className="text-xs"
              >
                ← Back
              </Button>
            )}

            {/* Center Dots */}
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    currentStep > i
                      ? "bg-primary"
                      : currentStep === i + 1
                        ? "bg-primary/70 scale-110"
                        : "bg-muted-foreground/20",
                  )}
                />
              ))}
            </div>

            {/* Right Button */}
            {currentStep < totalSteps ? (
              <Button
                onClick={handleNext}
                size="sm"
                disabled={isSubmitting}
                className="text-xs px-3"
              >
                {currentStep === 2 && isAddingTenants
                  ? "Generate →"
                  : (currentStep === 1 &&
                        !isAddingTenants) ||
                      (currentStep === 3 &&
                        isAddingTenants)
                    ? "Review →"
                    : "Next →"}
              </Button>
            ) : (
              <Button
                onClick={handleCompleteClick}
                size="sm"
                variant="default"
                disabled={isSubmitting}
                className="text-xs px-3 bg-green-600 hover:bg-green-700"
              >
                Complete ✓
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog - Simplified */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              Confirm Property Addition
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 mt-2">
                <div className="bg-muted/50 p-3 rounded border text-sm">
                  <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        Unit
                      </span>
                      <span className="font-medium block">
                        {formData.unitName}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        Type
                      </span>
                      <span>{formData.propertyType}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        Rent
                      </span>
                      <span className="text-green-600 font-medium block">
                        ₱{formData.rentAmount.toLocaleString()}
                      </span>
                      {formData.billingType === "pre-organized" &&
                        formData.maxTenants > 1 &&
                        formData.rentPerCollection > 0 && (
                          <span className="text-xs text-muted-foreground block">
                            (₱{formData.rentPerCollection.toLocaleString()} per
                            tenant)
                          </span>
                        )}
                    </div>
                  </div>
                </div>

                {/* Streamlined confirmation message */}
                <div className="text-sm">
                  Are you ready to add this property to your portfolio?
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              onClick={handleCancelConfirmation}
              className="text-xs"
            >
              Review Details
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSubmit}
              disabled={isSubmitting}
              className="text-xs bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  Add Property
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Other Charges Popup - No changes needed here */}
      {selectedBillingIndex !== null && (
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
          existingItems={
            formData.billingSchedule[selectedBillingIndex].expenseItems
          }
          disabled={false}
        />
      )}
    </>
  );
}

// Helper function to get appropriate progress bar color based on step
function getProgressBarColor(step: number) {
  switch (step) {
    case 1:
      return "bg-blue-500 dark:bg-blue-600";
    case 2:
      return "bg-purple-500 dark:bg-purple-600";
    case 3:
      return "bg-orange-500 dark:bg-orange-600";
    case 4:
      return "bg-green-500 dark:bg-green-600";
    default:
      return "bg-primary";
  }
}
