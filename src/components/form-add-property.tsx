"use client";

import React, { useState, useEffect } from "react";
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

// Interface for individual tenant in bed space
interface TenantInfo {
  tenantName: string;
  tenantEmail: string;
  contactNumber: string;
}

interface PropertyFormData {
  // Existing fields
  unitName: string;
  propertyType: string;
  occupancyStatus: "occupied" | "vacant";

  // Legacy fields (kept for backward compatibility with single tenant)
  tenantName: string;
  tenantEmail: string;
  contactNumber: string;

  // Bed space fields (pax = maxTenants = number of tenants)
  pax: number; // Legacy: kept for backward compatibility, same as maxTenants
  maxTenants: number;
  tenants: TenantInfo[];

  propertyLocation: string;
  billingType: "pre-organized" | "blank";
  contractMonths: number;
  rentStartDate: string;
  dueDay: string;
  rentAmount: number;

  // Pre-organized billing fields
  formBasis:
    | "weekly"
    | "bi-weekly"
    | "monthly"
    | "quarterly"
    | "semi-annually"
    | "annually";
  collectionDay: string; // For weekly: "monday" - "sunday"
  collectionDates: number[]; // For bi-weekly: [date1, date2], monthly: [date1]
  rentPerCollection: number;

  // Accounting & Monitoring fields
  advancePayment: number;
  securityDeposit: number;

  // Update the billing schedule to include expense items
  billingSchedule: Array<{
    dueDate: string;
    rentDue: number;
    otherCharges: number;
    grossDue: number;
    status: string;
    expenseItems: Array<{
      id: string;
      name: string;
      amount: number;
    }>;
  }>;
}

interface ValidationErrors {
  unitName?: string;
  propertyType?: string;
  maxTenants?: string;
  tenantName?: string;
  tenantEmail?: string;
  contactNumber?: string;
  pax?: string;
  propertyLocation?: string;
  contractMonths?: string;
  rentStartDate?: string;
  rentAmount?: string;
  [key: string]: string | undefined; // Allow dynamic keys for tenant validation
}

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
  const paxCount =
    formData.maxTenants > 1
      ? filledTenantsCount > 0
        ? filledTenantsCount
        : formData.maxTenants
      : formData.tenantName
        ? 1
        : 0;
  const perPersonRent =
    formData.rentAmount && paxCount > 1
      ? Math.floor(formData.rentAmount / paxCount)
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
                formData.occupancyStatus === "occupied"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                  : "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
              )}
            >
              {formData.occupancyStatus === "occupied" ? "Occupied" : "Vacant"}
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
                Monthly Rent
              </span>
              <div className="text-right">
                <div className="text-sm font-semibold text-green-600">
                  ₱{formData.rentAmount.toLocaleString() || "0"}/month
                </div>
                {paxCount > 1 && (
                  <div className="text-xs text-muted-foreground">
                    ₱{perPersonRent.toLocaleString()} per person
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Occupancy Information */}
          {formData.occupancyStatus === "occupied" && (
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
      {currentStep >= 2 && formData.occupancyStatus === "occupied" && (
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
                    {new Date(formData.rentStartDate).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      },
                    )}
                  </span>
                </div>
              )}

              {formData.contractMonths > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">
                    {formData.contractMonths} months
                  </span>
                </div>
              )}

              {formData.billingType === "pre-organized" && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Billing Type</span>
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
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Per Collection
                      </span>
                      <span className="font-medium text-green-600">
                        ₱{formData.rentPerCollection.toLocaleString()}
                      </span>
                    </div>
                  )}
                </>
              )}

              {formData.billingType === "blank" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Billing Type</span>
                  <span className="font-medium">Blank (Custom)</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accounting Preview */}
      {currentStep >= 3 && formData.occupancyStatus === "occupied" && (
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
                  <span>
                    {new Date(bill.dueDate).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
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
    occupancyStatus: "vacant",
    tenantName: "",
    tenantEmail: "",
    contactNumber: "",
    pax: 1,
    maxTenants: 1,
    tenants: [],
    propertyLocation: "",
    billingType: "pre-organized",
    contractMonths: 6,
    rentStartDate: "",
    dueDay: "15",
    rentAmount: 0,
    formBasis: "monthly",
    collectionDay: "monday",
    collectionDates: [1],
    rentPerCollection: 0,
    advancePayment: 0,
    securityDeposit: 0,
    billingSchedule: [],
  });
  const [isOtherChargesPopupOpen, setIsOtherChargesPopupOpen] = useState(false);
  const [selectedBillingIndex, setSelectedBillingIndex] = useState<
    number | null
  >(null);

  // Update total steps based on occupancy status
  const totalSteps =
    formData.occupancyStatus === "vacant"
      ? 2
      : formData.billingType === "blank"
        ? 3
        : 4;

  // Auto-adjust collectionDates when formBasis changes
  useEffect(() => {
    if (
      formData.formBasis === "bi-weekly" &&
      formData.collectionDates.length !== 2
    ) {
      setFormData((prev) => ({ ...prev, collectionDates: [1, 16] }));
    } else if (
      formData.formBasis === "monthly" &&
      formData.collectionDates.length !== 1
    ) {
      setFormData((prev) => ({ ...prev, collectionDates: [1] }));
    }
  }, [formData.formBasis, formData.collectionDates.length]);

  // Auto-generate billing schedule when Step 2 fields change
  useEffect(() => {
    // Only auto-generate if we're in Step 2 and have the necessary data
    if (
      currentStep === 2 &&
      formData.occupancyStatus === "occupied" &&
      formData.billingType === "pre-organized" &&
      formData.contractMonths > 0 &&
      formData.rentStartDate &&
      formData.rentPerCollection > 0
    ) {
      // Auto-generate the billing schedule silently (without toast notification)
      const schedule: Array<{
        dueDate: string;
        rentDue: number;
        otherCharges: number;
        grossDue: number;
        status: string;
        expenseItems: Array<{
          id: string;
          name: string;
          amount: number;
        }>;
      }> = [];

      const [startYear, startMonth, startDay] = formData.rentStartDate
        .split("-")
        .map(Number);

      // Determine the collection day based on formBasis
      let collectionDay = startDay;
      if (
        formData.formBasis === "monthly" &&
        formData.collectionDates?.length > 0
      ) {
        collectionDay = formData.collectionDates[0];
      }

      for (let i = 0; i < formData.contractMonths; i++) {
        const dueDate = new Date(startYear, startMonth - 1 + i, startDay);
        const lastDayOfMonth = new Date(
          dueDate.getFullYear(),
          dueDate.getMonth() + 1,
          0,
        ).getDate();

        dueDate.setDate(Math.min(collectionDay, lastDayOfMonth));

        const year = dueDate.getFullYear();
        const month = String(dueDate.getMonth() + 1).padStart(2, "0");
        const day = String(dueDate.getDate()).padStart(2, "0");
        const formattedDate = `${year}-${month}-${day}`;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const status = dueDate < today ? "Overdue" : "Not Yet Due";

        schedule.push({
          dueDate: formattedDate,
          rentDue: formData.rentPerCollection,
          otherCharges: 0,
          grossDue: formData.rentPerCollection,
          status: status,
          expenseItems: [],
        });
      }

      setFormData((prev) => ({ ...prev, billingSchedule: schedule }));
    }
  }, [
    currentStep,
    formData.occupancyStatus,
    formData.billingType,
    formData.contractMonths,
    formData.rentStartDate,
    formData.rentPerCollection,
    formData.collectionDates,
    formData.formBasis,
  ]);

  // Sync rentPerCollection to rentAmount for occupied properties
  useEffect(() => {
    if (
      formData.occupancyStatus === "occupied" &&
      formData.billingType === "pre-organized" &&
      formData.rentPerCollection > 0 &&
      formData.rentPerCollection !== formData.rentAmount
    ) {
      setFormData((prev) => ({
        ...prev,
        rentAmount: formData.rentPerCollection,
      }));
    }
  }, [
    formData.rentPerCollection,
    formData.occupancyStatus,
    formData.billingType,
    formData.rentAmount,
  ]);

  // Validation functions
  const validateStep1 = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Unit Name validation
    if (!formData.unitName.trim()) {
      newErrors.unitName = "Unit name is required";
    } else if (formData.unitName.trim().length < 2) {
      newErrors.unitName = "Unit name must be at least 2 characters";
    }

    // Property Type validation
    if (!formData.propertyType) {
      newErrors.propertyType = "Property type is required";
    }

    // Property Location validation
    if (!formData.propertyLocation.trim()) {
      newErrors.propertyLocation = "Property location is required";
    } else if (formData.propertyLocation.trim().length < 10) {
      newErrors.propertyLocation =
        "Please provide a complete address (minimum 10 characters)";
    }

    // Rent Amount validation for vacant properties
    if (formData.occupancyStatus === "vacant") {
      if (!formData.rentAmount || formData.rentAmount <= 0) {
        newErrors.rentAmount = "Rent amount must be greater than 0";
      } else if (formData.rentAmount < 1000) {
        newErrors.rentAmount = "Rent amount seems too low (minimum ₱1,000)";
      } else if (formData.rentAmount > 1000000) {
        newErrors.rentAmount =
          "Rent amount seems too high (maximum ₱1,000,000)";
      }
    }

    // Tenant details validation (only if occupied)
    if (formData.occupancyStatus === "occupied") {
      // Max Tenants validation
      if (!formData.maxTenants || formData.maxTenants < 1) {
        newErrors.maxTenants = "At least 1 tenant slot is required";
      } else if (formData.maxTenants > 20) {
        newErrors.maxTenants = "Maximum 20 tenant slots allowed";
      }

      // If bed space (multiple tenants), validate tenant array
      if (formData.maxTenants > 1) {
        // At least one tenant must be filled
        const hasAnyTenant = formData.tenants.some(
          (t) => t.tenantName || t.tenantEmail || t.contactNumber,
        );

        if (!hasAnyTenant) {
          newErrors.tenantName =
            "At least one tenant is required for occupied property";
        }
      } else {
        // Single tenant mode - use legacy validation
        if (!formData.tenantName.trim()) {
          newErrors.tenantName =
            "Tenant name is required for occupied properties";
        } else if (formData.tenantName.trim().length < 2) {
          newErrors.tenantName = "Tenant name must be at least 2 characters";
        }

        if (!formData.tenantEmail.trim()) {
          newErrors.tenantEmail = "Email is required for occupied properties";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.tenantEmail)) {
          newErrors.tenantEmail = "Please enter a valid email address";
        }

        if (!formData.contactNumber.trim()) {
          newErrors.contactNumber =
            "Contact number is required for occupied properties";
        } else if (
          !/^(\+63|0)?9\d{9}$/.test(formData.contactNumber.replace(/\s|-/g, ""))
        ) {
          newErrors.contactNumber =
            "Please enter a valid Philippine mobile number (e.g., 09123456789)";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Contract Months validation (only for pre-organized)
    if (formData.billingType === "pre-organized") {
      if (!formData.contractMonths || formData.contractMonths < 1) {
        newErrors.contractMonths = "Contract duration must be at least 1 month";
      } else if (formData.contractMonths > 24) {
        newErrors.contractMonths = "Contract duration cannot exceed 24 months";
      }
    }

    // Rent Start Date validation - only check if it's provided, not the date range
    if (!formData.rentStartDate) {
      newErrors.rentStartDate = "Rent start date is required";
    }

    // Blank billing only requires start date
    if (formData.billingType === "blank") {
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }

    // Pre-organized billing validation
    if (formData.billingType === "pre-organized") {
      // Rent Per Collection validation
      if (!formData.rentPerCollection || formData.rentPerCollection <= 0) {
        newErrors.rentAmount = "Rent per collection must be greater than 0";
      } else if (formData.rentPerCollection < 1000) {
        newErrors.rentAmount = "Default minimum: ₱1,000";
      } else if (formData.rentPerCollection > 1000000) {
        newErrors.rentAmount = "Default maximum: ₱1,000,000";
      }

      // Collection date validation for bi-weekly
      if (formData.formBasis === "bi-weekly") {
        if (!formData.collectionDates[0] || !formData.collectionDates[1]) {
          newErrors.rentAmount =
            "Both collection dates are required for bi-weekly";
        }
      }

      // Collection date validation for monthly
      if (formData.formBasis === "monthly") {
        if (!formData.collectionDates[0]) {
          newErrors.rentAmount = "Collection date is required for monthly";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateBillingSchedule = (): boolean => {
    // Billing schedule validation (if needed in the future)
    return true;
  };

  // Helper function to generate tenant fields based on maxTenants
  const handleMaxTenantsChange = (value: number) => {
    const newMaxTenants = Math.max(1, Math.min(20, value)); // Limit between 1-20

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
    const newErrors: ValidationErrors = {};
    let isValid = true;

    formData.tenants.forEach((tenant, index) => {
      // Check if at least one tenant field is filled (partial validation)
      const hasAnyData =
        tenant.tenantName || tenant.tenantEmail || tenant.contactNumber;

      // If any field is filled, validate all fields for this tenant
      if (hasAnyData) {
        if (!tenant.tenantName.trim()) {
          newErrors[`tenant${index}_name`] = `Tenant ${
            index + 1
          } name is required`;
          isValid = false;
        } else if (tenant.tenantName.trim().length < 2) {
          newErrors[`tenant${index}_name`] = `Tenant ${
            index + 1
          } name must be at least 2 characters`;
          isValid = false;
        }

        if (!tenant.tenantEmail.trim()) {
          newErrors[`tenant${index}_email`] = `Tenant ${
            index + 1
          } email is required`;
          isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenant.tenantEmail)) {
          newErrors[`tenant${index}_email`] =
            `Please enter a valid email for tenant ${index + 1}`;
          isValid = false;
        }

        if (!tenant.contactNumber.trim()) {
          newErrors[`tenant${index}_contact`] = `Tenant ${
            index + 1
          } contact is required`;
          isValid = false;
        } else if (
          !/^(\+63|0)?9\d{9}$/.test(tenant.contactNumber.replace(/\s|-/g, ""))
        ) {
          newErrors[`tenant${index}_contact`] =
            `Invalid Philippine mobile number for tenant ${index + 1}`;
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
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

  const handleNext = () => {
    let isValid = true;

    if (currentStep === 1) {
      isValid = validateStep1();
      // Additional validation for bed space mode with multiple tenants
      if (
        isValid &&
        formData.occupancyStatus === "occupied" &&
        formData.maxTenants > 1
      ) {
        isValid = validateTenants();
      }
    } else if (currentStep === 2 && formData.occupancyStatus === "occupied") {
      isValid = validateStep2();
    } else if (currentStep === 3 && formData.occupancyStatus === "occupied") {
      isValid = validateBillingSchedule();
    }

    if (!isValid) {
      return;
    }

    if (currentStep < totalSteps) {
      // For vacant properties, show confirmation after step 1
      if (formData.occupancyStatus === "vacant" && currentStep === 1) {
        setShowConfirmation(true);
      }
      // For occupied properties with blank billing, show confirmation after step 2
      else if (
        formData.occupancyStatus === "occupied" &&
        formData.billingType === "blank" &&
        currentStep === 2
      ) {
        setShowConfirmation(true);
      }
      // For occupied properties with pre-organized billing, show confirmation after step 3 (billing review)
      else if (
        formData.occupancyStatus === "occupied" &&
        formData.billingType === "pre-organized" &&
        currentStep === 3
      ) {
        setShowConfirmation(true);
      }
      // Normal flow for other steps
      else if (
        currentStep === 2 &&
        formData.occupancyStatus === "occupied" &&
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

  const handleConfirmSubmit = () => {
    setShowConfirmation(false);
    setCurrentStep(totalSteps); // Go to final completion step
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
      occupancyStatus: "vacant",
      tenantName: "",
      tenantEmail: "",
      contactNumber: "",
      pax: 1,
      maxTenants: 1,
      tenants: [],
      propertyLocation: "",
      contractMonths: 6,
      rentStartDate: "",
      dueDay: "30th/31st - Last Day",
      rentAmount: 0,
      billingType: "pre-organized",
      formBasis: "monthly",
      collectionDay: "monday",
      collectionDates: [1],
      rentPerCollection: 0,
      advancePayment: 0,
      securityDeposit: 0,
      billingSchedule: [],
    });
    onClose();
  };

  const generateBillingSchedule = () => {
    const schedule: Array<{
      dueDate: string;
      rentDue: number;
      otherCharges: number;
      grossDue: number;
      status: string;
      expenseItems: Array<{
        id: string;
        name: string;
        amount: number;
      }>;
    }> = [];

    if (!formData.rentStartDate) {
      toast.error("Please select a rent start date first");
      return;
    }

    // Use rentPerCollection for pre-organized billing, falling back to rentAmount for vacant properties
    const rentAmount = formData.rentPerCollection || formData.rentAmount;

    if (!rentAmount || rentAmount <= 0) {
      toast.error("Please enter a valid rent amount");
      return;
    }

    // Parse the start date as local date to avoid timezone issues
    const [startYear, startMonth, startDay] = formData.rentStartDate
      .split("-")
      .map(Number);
    const startDate = new Date(startYear, startMonth - 1, startDay);

    // contractMonths represents the number of payment periods, not duration in months
    const numberOfPeriods = formData.contractMonths;

    // Helper function to format date as YYYY-MM-DD
    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    // Helper function to get status based on due date
    const getStatus = (dueDate: Date): string => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return dueDate < today ? "Overdue" : "Not Yet Due";
    };

    // Helper function to add billing entry
    const addBillingEntry = (dueDate: Date) => {
      schedule.push({
        dueDate: formatDate(dueDate),
        rentDue: rentAmount,
        otherCharges: 0,
        grossDue: rentAmount,
        status: getStatus(dueDate),
        expenseItems: [],
      });
    };

    // Helper function to get next occurrence of a day of week
    const getNextDayOfWeek = (fromDate: Date, dayName: string): Date => {
      const days = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const targetDay = days.indexOf(dayName.toLowerCase());
      const currentDay = fromDate.getDay();
      const daysUntilTarget = (targetDay - currentDay + 7) % 7;
      const nextDate = new Date(fromDate);
      nextDate.setDate(
        fromDate.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget),
      );
      return nextDate;
    };

    // Generate billing schedule based on formBasis
    switch (formData.formBasis) {
      case "weekly": {
        // Generate exactly numberOfPeriods weekly billing entries
        let currentDate = getNextDayOfWeek(
          new Date(startDate.getTime() - 24 * 60 * 60 * 1000),
          formData.collectionDay,
        );

        // If the first collection date is the same as start date, skip to next week
        if (currentDate.getTime() === startDate.getTime()) {
          currentDate = new Date(currentDate);
          currentDate.setDate(currentDate.getDate() + 7);
        }

        for (let i = 0; i < numberOfPeriods; i++) {
          addBillingEntry(currentDate);
          currentDate = new Date(currentDate);
          currentDate.setDate(currentDate.getDate() + 7);
        }
        break;
      }

      case "bi-weekly": {
        // Generate exactly numberOfPeriods bi-weekly billing entries
        if (
          !formData.collectionDates ||
          formData.collectionDates.length !== 2
        ) {
          toast.error(
            "Please select two collection dates for bi-weekly billing",
          );
          return;
        }

        const [date1, date2] = formData.collectionDates.sort((a, b) => a - b);
        let currentMonth = new Date(startDate);
        currentMonth.setDate(1);
        let periodCount = 0;

        // Determine which date to start with in the first month
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

        // Skip the first date if it's before or equal to startDate
        let useFirstDate = firstDateInStartMonth > startDate;
        let useSecondDate = secondDateInStartMonth > startDate;

        // If both dates in the start month have passed or equal startDate, move to next month
        if (!useFirstDate && !useSecondDate) {
          currentMonth.setMonth(currentMonth.getMonth() + 1);
          useFirstDate = true;
          useSecondDate = true;
        }

        while (periodCount < numberOfPeriods) {
          const year = currentMonth.getFullYear();
          const month = currentMonth.getMonth();
          const lastDay = new Date(year, month + 1, 0).getDate();

          // Add first date if we should use it
          if (useFirstDate && periodCount < numberOfPeriods) {
            const dueDate = new Date(year, month, Math.min(date1, lastDay));
            addBillingEntry(dueDate);
            periodCount++;
          }

          // Add second date if we should use it
          if (useSecondDate && periodCount < numberOfPeriods) {
            const dueDate = new Date(year, month, Math.min(date2, lastDay));
            addBillingEntry(dueDate);
            periodCount++;
          }

          // Move to next month and reset both dates to be used
          currentMonth.setMonth(currentMonth.getMonth() + 1);
          useFirstDate = true;
          useSecondDate = true;
        }
        break;
      }

      case "monthly": {
        // Generate exactly numberOfPeriods monthly billing entries
        if (
          !formData.collectionDates ||
          formData.collectionDates.length === 0
        ) {
          toast.error("Please select a collection date for monthly billing");
          return;
        }

        const collectionDay = formData.collectionDates[0];

        // Check if the collection day in the start month has already passed or equals startDate
        const firstPossibleDate = new Date(
          startYear,
          startMonth - 1,
          collectionDay,
        );
        let monthOffset = 0;

        // If the collection date in the start month is before or equal to startDate, skip to next month
        if (firstPossibleDate <= startDate) {
          monthOffset = 1;
        }

        for (let i = 0; i < numberOfPeriods; i++) {
          const dueDate = new Date(
            startYear,
            startMonth - 1 + monthOffset + i,
            1,
          );

          // Get last day of this month
          const lastDayOfMonth = new Date(
            dueDate.getFullYear(),
            dueDate.getMonth() + 1,
            0,
          ).getDate();

          // Set the collection day, adjusting for shorter months
          dueDate.setDate(Math.min(collectionDay, lastDayOfMonth));

          addBillingEntry(dueDate);
        }
        break;
      }

      case "quarterly": {
        // Generate exactly numberOfPeriods quarterly billing entries (every 3 months)
        let currentDate = new Date(startDate);

        // If the first collection date equals start date, move to next quarter
        currentDate.setMonth(currentDate.getMonth() + 3);

        for (let i = 0; i < numberOfPeriods; i++) {
          addBillingEntry(currentDate);
          currentDate = new Date(currentDate);
          currentDate.setMonth(currentDate.getMonth() + 3);
        }
        break;
      }

      case "semi-annually": {
        // Generate exactly numberOfPeriods semi-annual billing entries (every 6 months)
        let currentDate = new Date(startDate);

        // If the first collection date equals start date, move to next semi-annual period
        currentDate.setMonth(currentDate.getMonth() + 6);

        for (let i = 0; i < numberOfPeriods; i++) {
          addBillingEntry(currentDate);
          currentDate = new Date(currentDate);
          currentDate.setMonth(currentDate.getMonth() + 6);
        }
        break;
      }

      case "annually": {
        // Generate exactly numberOfPeriods annual billing entries (every 12 months)
        let currentDate = new Date(startDate);

        // If the first collection date equals start date, move to next year
        currentDate.setMonth(currentDate.getMonth() + 12);

        for (let i = 0; i < numberOfPeriods; i++) {
          addBillingEntry(currentDate);
          currentDate = new Date(currentDate);
          currentDate.setMonth(currentDate.getMonth() + 12);
        }
        break;
      }

      default:
        toast.error("Invalid billing frequency selected");
        return;
    }

    // Sort schedule by date
    schedule.sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );

    setFormData((prev) => ({ ...prev, billingSchedule: schedule }));

    const frequencyLabel =
      formData.formBasis.charAt(0).toUpperCase() + formData.formBasis.slice(1);
    toast.success(`${frequencyLabel} billing schedule generated`, {
      description: `${schedule.length} billing entries created`,
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
          occupancyStatus: "vacant",
          tenantName: "",
          tenantEmail: "",
          contactNumber: "",
          pax: 1,
          maxTenants: 1,
          tenants: [],
          propertyLocation: "",
          billingType: "pre-organized",
          contractMonths: 0,
          rentStartDate: "",
          dueDay: "30th/31st - Last Day",
          rentAmount: 0,
          formBasis: "monthly",
          collectionDay: "monday",
          collectionDates: [1],
          rentPerCollection: 0,
          advancePayment: 0,
          securityDeposit: 0,
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
    if (formData.occupancyStatus === "vacant") {
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
            description: "Review and confirm generated billing table",
            color: "text-orange-600 dark:text-orange-400",
            bgColor: "bg-orange-50 dark:bg-orange-950/30",
            borderColor: "border-orange-200 dark:border-orange-800",
          };
        case 4:
          return {
            icon: <CheckCircle className="h-5 w-5 md:h-7 md:w-7" />,
            title: "Complete",
            description: "Property successfully added to your portfolio",
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
                            value={formData.maxTenants}
                            onChange={(e) =>
                              handleMaxTenantsChange(
                                parseInt(e.target.value) || 1,
                              )
                            }
                            placeholder="1"
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
                            (1-20)
                          </p>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Status</Label>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <Button
                              type="button"
                              variant={
                                formData.occupancyStatus === "occupied"
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              className="h-auto py-2 flex items-center gap-2 text-xs"
                              onClick={() =>
                                updateFormData("occupancyStatus", "occupied")
                              }
                            >
                              <User className="h-3.5 w-3.5" />
                              <span>Occupied</span>
                            </Button>
                            <Button
                              type="button"
                              variant={
                                formData.occupancyStatus === "vacant"
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              className="h-auto py-2 flex items-center gap-2 text-xs"
                              onClick={() =>
                                updateFormData("occupancyStatus", "vacant")
                              }
                            >
                              <Building className="h-3.5 w-3.5" />
                              <span>Available</span>
                            </Button>
                          </div>
                        </div>

                        {formData.occupancyStatus === "occupied" && (
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
                        )}

                        {formData.occupancyStatus === "vacant" && (
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
                                min="0"
                                value={formData.rentAmount}
                                onChange={(e) =>
                                  updateFormData(
                                    "rentAmount",
                                    e.target.value === ""
                                      ? ""
                                      : parseInt(e.target.value) || "",
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
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Step 2: Billing Setup - More compact */}
              {currentStep === 2 && formData.occupancyStatus === "occupied" && (
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
                            Billing Type *
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
                                min="0"
                                value={formData.contractMonths}
                                onChange={(e) =>
                                  updateFormData(
                                    "contractMonths",
                                    e.target.value === ""
                                      ? ""
                                      : parseInt(e.target.value) || "",
                                  )
                                }
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
                                Typically 6-12 months for residential
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
                                      updateFormData("formBasis", basis as any)
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
                                Rent per Tenant per Collection Date (₱) *
                              </Label>
                              <Input
                                id="rentPerCollection"
                                type="number"
                                min="0"
                                value={formData.rentPerCollection}
                                onChange={(e) =>
                                  updateFormData(
                                    "rentPerCollection",
                                    e.target.value === ""
                                      ? ""
                                      : parseInt(e.target.value) || "",
                                  )
                                }
                                placeholder="Enter amount"
                                className="h-9 text-sm"
                              />
                              <p className="text-xs text-muted-foreground">
                                Amount to collect on each {formData.formBasis}{" "}
                                rent date
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
              {currentStep === 3 && formData.occupancyStatus === "occupied" && (
                <div className="space-y-4">
                  <div className="bg-orange-50/50 dark:bg-orange-950/20 rounded-lg border border-orange-100 dark:border-orange-900/50 p-2">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="p-1 rounded-full bg-orange-100 dark:bg-orange-900/50">
                        <CreditCard className="h-3.5 w-3.5 text-orange-600" />
                      </div>
                      <div className="text-sm font-medium text-orange-800 dark:text-orange-300">
                        Review billing schedule for{" "}
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
                            value={formData.advancePayment}
                            onChange={(e) =>
                              updateFormData(
                                "advancePayment",
                                e.target.value === ""
                                  ? ""
                                  : parseInt(e.target.value) || "",
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
                            value={formData.securityDeposit}
                            onChange={(e) =>
                              updateFormData(
                                "securityDeposit",
                                e.target.value === ""
                                  ? ""
                                  : parseInt(e.target.value) || "",
                              )
                            }
                            placeholder="Enter security deposit amount"
                            className="h-9 text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Refundable security deposit amount
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
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 rounded-full bg-orange-100 dark:bg-orange-950/50">
                          <CreditCard className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                          <h3 className="text-base md:text-lg font-semibold text-foreground">
                            Billing Schedule
                          </h3>
                        </div>
                      </div>
                    </CardContent>

                    {/* Mobile: Stack layout, Desktop: Table layout */}
                    <div className="block sm:hidden">
                      {/* Mobile Card Layout */}
                      <div className="divide-y">
                        {formData.billingSchedule.map((bill, index) => (
                          <div key={index} className="p-3">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="text-xs font-medium">
                                {index + 1}
                              </h4>
                              <span className="text-xs bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full">
                                {bill.dueDate}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <div className="text-muted-foreground">
                                  Rent
                                </div>
                                <div className="font-medium text-green-600">
                                  ₱{bill.rentDue.toLocaleString()}
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">
                                  Other Charges
                                </div>
                                <button
                                  onClick={() => handleOtherChargesClick(index)}
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
                                <div className="text-xs font-medium px-2 py-1 rounded bg-muted inline-block">
                                  {bill.status}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Desktop Table Layout */}
                    <div className="hidden sm:block">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-muted/50 text-xs font-medium">
                              <th className="text-left p-2">Period</th>
                              <th className="text-left p-2">Due Date</th>
                              <th className="text-left p-2">Rent</th>
                              <th className="text-left p-2">Other Charges</th>
                              <th className="text-left p-2">Total Due</th>
                              <th className="text-left p-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm">
                            {formData.billingSchedule.map((bill, index) => (
                              <tr
                                key={index}
                                className={`border-b hover:bg-muted/30 ${
                                  index % 2 === 0
                                    ? "bg-background"
                                    : "bg-muted/10"
                                }`}
                              >
                                <td className="p-2 text-xs">{index + 1}</td>
                                <td className="p-2 text-xs">{bill.dueDate}</td>
                                <td className="p-2 text-xs font-medium text-green-600">
                                  ₱{bill.rentDue.toLocaleString()}
                                </td>
                                <td className="p-2 text-xs">
                                  <button
                                    onClick={() =>
                                      handleOtherChargesClick(index)
                                    }
                                    className="flex items-center gap-1 text-blue-600 font-medium"
                                  >
                                    ₱{bill.otherCharges.toLocaleString()}
                                    <span className="ml-1 text-[10px] bg-blue-50 text-blue-700 px-1 py-0.5 rounded">
                                      {bill.expenseItems.length}
                                    </span>
                                    <EditIcon className="h-3 w-3" />
                                  </button>
                                </td>
                                <td className="p-2 text-xs font-semibold">
                                  ₱{bill.grossDue.toLocaleString()}
                                </td>
                                <td className="p-2 text-xs">
                                  <span className="inline-block px-2 py-1 rounded bg-muted text-xs font-medium">
                                    {bill.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
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
                        <div>
                          <span className="text-muted-foreground">
                            Monthly:
                          </span>{" "}
                          <span className="font-medium text-green-600">
                            ₱{formData.rentAmount.toLocaleString()}
                          </span>
                        </div>
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
                            {formData.occupancyStatus === "vacant" ? (
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

                        {formData.occupancyStatus === "occupied" && (
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
                                {formData.contractMonths} months
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
                {currentStep === 2 && formData.occupancyStatus === "occupied"
                  ? "Generate →"
                  : (currentStep === 1 &&
                        formData.occupancyStatus === "vacant") ||
                      (currentStep === 3 &&
                        formData.occupancyStatus === "occupied")
                    ? "Review →"
                    : "Next →"}
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                size="sm"
                variant="default"
                disabled={isSubmitting}
                className="text-xs px-3 bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                    Saving...
                  </>
                ) : (
                  "Complete ✓"
                )}
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
                        Status
                      </span>
                      <span className="capitalize font-medium block">
                        {formData.occupancyStatus}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">
                        Rent
                      </span>
                      <span className="text-green-600 font-medium block">
                        ₱{formData.rentAmount.toLocaleString()}
                      </span>
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
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Add Property
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
