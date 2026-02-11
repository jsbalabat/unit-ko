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
  contractMonths: number;
  rentStartDate: string;
  dueDay: string;
  rentAmount: number;

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
  const paxCount =
    formData.maxTenants > 1 ? formData.maxTenants : formData.tenantName ? 1 : 0;
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
                      <span className="font-medium">Main Tenant</span>
                    </div>
                    {formData.tenantName && (
                      <p className="text-xs ml-5">{formData.tenantName}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {formData.tenants.map(
                      (tenant, idx) =>
                        tenant.tenantName && (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-xs"
                          >
                            <User
                              className={cn(
                                "h-3 w-3",
                                idx === 0
                                  ? "text-blue-600"
                                  : "text-muted-foreground",
                              )}
                            />
                            <span className={idx === 0 ? "font-medium" : ""}>
                              {idx === 0 ? "Main: " : `Person ${idx + 1}: `}
                              {tenant.tenantName}
                            </span>
                          </div>
                        ),
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

              {formData.dueDay && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Day</span>
                  <span className="font-medium">
                    {formData.dueDay === "last"
                      ? "Last day of month"
                      : `Day ${formData.dueDay} of month`}
                  </span>
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
    contractMonths: 6,
    rentStartDate: "",
    dueDay: "15",
    rentAmount: 0,
    advancePayment: 0,
    securityDeposit: 0,
    billingSchedule: [],
  });
  const [isOtherChargesPopupOpen, setIsOtherChargesPopupOpen] = useState(false);
  const [selectedBillingIndex, setSelectedBillingIndex] = useState<
    number | null
  >(null);

  // Update total steps based on occupancy status
  const totalSteps = formData.occupancyStatus === "vacant" ? 2 : 4;

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

    // Contract Months validation
    if (!formData.contractMonths || formData.contractMonths < 1) {
      newErrors.contractMonths = "Contract duration must be at least 1 month";
    } else if (formData.contractMonths > 24) {
      newErrors.contractMonths = "Contract duration cannot exceed 24 months";
    }

    // Rent Start Date validation - only check if it's provided, not the date range
    if (!formData.rentStartDate) {
      newErrors.rentStartDate = "Rent start date is required";
    }

    // Rent Amount validation
    if (!formData.rentAmount || formData.rentAmount <= 0) {
      newErrors.rentAmount = "Rent amount must be greater than 0";
    } else if (formData.rentAmount < 1000) {
      newErrors.rentAmount = "Default minimum: ₱1,000";
    } else if (formData.rentAmount > 1000000) {
      newErrors.rentAmount = "Default maximum: ₱1,000,000";
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
      // For occupied properties, show confirmation after step 3 (billing review)
      else if (formData.occupancyStatus === "occupied" && currentStep === 3) {
        setShowConfirmation(true);
      }
      // Normal flow for other steps
      else if (currentStep === 2 && formData.occupancyStatus === "occupied") {
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

    // Parse the start date as local date to avoid timezone issues
    const [startYear, startMonth, startDay] = formData.rentStartDate
      .split("-")
      .map(Number);
    // const startDate = new Date(startYear, startMonth - 1, startDay);

    for (let i = 0; i < formData.contractMonths; i++) {
      // Create a new date for each billing period
      const dueDate = new Date(startYear, startMonth - 1 + i, startDay);

      if (formData.dueDay === "last") {
        dueDate.setMonth(dueDate.getMonth() + 1, 0);
      } else {
        const dueDay = parseInt(formData.dueDay) || 1;
        const lastDayOfMonth = new Date(
          dueDate.getFullYear(),
          dueDate.getMonth() + 1,
          0,
        ).getDate();

        dueDate.setDate(Math.min(dueDay, lastDayOfMonth));
      }

      const year = dueDate.getFullYear();
      const month = String(dueDate.getMonth() + 1).padStart(2, "0");
      const day = String(dueDate.getDate()).padStart(2, "0");
      const formattedDate = `${year}-${month}-${day}`;

      const otherCharges = 0;
      const expenseItems: Array<{
        id: string;
        name: string;
        amount: number;
      }> = [];

      // Determine initial status based on due date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const status = dueDate < today ? "Overdue" : "Not Yet Due";

      schedule.push({
        dueDate: formattedDate,
        rentDue: formData.rentAmount,
        otherCharges: otherCharges,
        grossDue: formData.rentAmount + otherCharges,
        status: status,
        expenseItems: expenseItems,
      });
    }

    setFormData((prev) => ({ ...prev, billingSchedule: schedule }));
    toast.success("Billing schedule generated successfully");
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
          contractMonths: 0,
          rentStartDate: "",
          dueDay: "30th/31st - Last Day",
          rentAmount: 0,
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
                        <div className="space-y-2">
                          <Label
                            htmlFor="contractMonths"
                            className="text-sm font-medium flex items-center gap-1.5"
                          >
                            <Clock className="h-3.5 w-3.5 text-purple-600" />
                            Contract Duration (Months) *
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
                              errors.contractMonths ? "border-destructive" : ""
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
                            Rent Agreement Date *
                          </Label>
                          <Input
                            id="rentStartDate"
                            type="date"
                            value={formData.rentStartDate}
                            onChange={(e) =>
                              updateFormData("rentStartDate", e.target.value)
                            }
                            className={`h-9 text-sm ${
                              errors.rentStartDate ? "border-destructive" : ""
                            }`}
                          />
                          {errors.rentStartDate && (
                            <p className="text-xs text-destructive">
                              {errors.rentStartDate}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            First billing cycle date
                          </p>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label
                            htmlFor="dueDay"
                            className="text-sm font-medium flex items-center gap-1.5"
                          >
                            <Calendar className="h-3.5 w-3.5 text-purple-600" />
                            Payment Due Day of Month *
                          </Label>

                          {/* Quick Selection Buttons */}
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            <Button
                              type="button"
                              variant={
                                formData.dueDay === "1" ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => updateFormData("dueDay", "1")}
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
                              onClick={() => updateFormData("dueDay", "15")}
                              className="h-8 text-xs"
                            >
                              15th - Mid Month
                            </Button>
                            <Button
                              type="button"
                              variant={
                                formData.dueDay === "last"
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => updateFormData("dueDay", "last")}
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
                              min="0"
                              value={
                                formData.dueDay === "last"
                                  ? ""
                                  : formData.dueDay
                              }
                              onChange={(e) => {
                                const value = e.target.value;
                                if (
                                  value === "" ||
                                  (parseInt(value) >= 1 &&
                                    parseInt(value) <= 31)
                                ) {
                                  updateFormData(
                                    "dueDay",
                                    value === "" ? "" : parseInt(value) || "",
                                  );
                                }
                              }}
                              placeholder="Or enter custom day (1-31)"
                              className="h-9 text-sm flex-1"
                              disabled={formData.dueDay === "last"}
                            />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              day of month
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            Select a preset or enter a custom day (1-31). Note:
                            Day 31 will adjust to last day for shorter months.
                          </p>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label
                            htmlFor="rentAmount"
                            className="text-sm font-medium flex items-center gap-1.5"
                          >
                            Monthly Rent Amount (₱) *
                          </Label>
                          <Input
                            id="rentAmount"
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
                          <p className="text-xs text-muted-foreground">
                            Base monthly rental fee
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Preview Panel */}
                  <Card className="bg-muted/20 border-dashed">
                    <CardContent className="p-3 md:p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium">Billing Preview</h3>
                        <div className="text-xs text-muted-foreground">
                          {formData.contractMonths} months from{" "}
                          {formData.rentStartDate
                            ? new Date(
                                formData.rentStartDate,
                              ).toLocaleDateString()
                            : "agreement date"}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from(
                          {
                            length: Math.min(formData.contractMonths || 0, 12),
                          },
                          (_, i) => {
                            const date = formData.rentStartDate
                              ? new Date(formData.rentStartDate)
                              : new Date();
                            date.setMonth(date.getMonth() + i);

                            // Set the due day based on selection
                            if (formData.dueDay === "last") {
                              date.setMonth(date.getMonth() + 1);
                              date.setDate(0); // Last day of month
                            } else {
                              const dueDay = parseInt(formData.dueDay) || 1;
                              const lastDayOfMonth = new Date(
                                date.getFullYear(),
                                date.getMonth() + 1,
                                0,
                              ).getDate();
                              date.setDate(Math.min(dueDay, lastDayOfMonth));
                            }

                            return (
                              <div
                                key={i}
                                className="px-2 py-1 bg-background text-xs rounded border flex items-center gap-1.5"
                              >
                                <Calendar className="h-3 w-3 text-purple-500" />
                                {date.toLocaleDateString("default", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </div>
                            );
                          },
                        )}
                        {formData.contractMonths > 12 && (
                          <div className="px-2 py-1 bg-background text-xs rounded border">
                            +{formData.contractMonths - 12} more
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
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
                                Month {index + 1}
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
                              <th className="text-left p-2">Month</th>
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
