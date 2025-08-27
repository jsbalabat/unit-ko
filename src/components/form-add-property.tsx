"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

interface PropertyFormData {
  // Step 1: Unit Details
  unitName: string;
  propertyType: string;
  occupancyStatus: "occupied" | "vacant";
  tenantName: string;
  contactNumber: string;
  propertyLocation: string;

  // Step 2: Billing Setup
  contractMonths: number;
  rentStartDate: string;
  dueDay: string;
  rentAmount: number;

  // Step 3: Generated Billing
  billingSchedule: Array<{
    dueDate: string;
    rentDue: number;
    otherCharges: number;
    grossDue: number;
    status: string;
  }>;
}

interface ValidationErrors {
  unitName?: string;
  propertyType?: string;
  tenantName?: string;
  contactNumber?: string;
  propertyLocation?: string;
  contractMonths?: string;
  rentStartDate?: string;
  rentAmount?: string;
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
    contactNumber: "",
    propertyLocation: "",
    contractMonths: 6,
    rentStartDate: "",
    dueDay: "30th/31st - Last Day",
    rentAmount: 0,
    billingSchedule: [],
  });

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
      if (!formData.tenantName.trim()) {
        newErrors.tenantName =
          "Tenant name is required for occupied properties";
      } else if (formData.tenantName.trim().length < 2) {
        newErrors.tenantName = "Tenant name must be at least 2 characters";
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
    // Check if any billing entries still have "Unassigned" status
    const hasUnassignedStatus = formData.billingSchedule.some(
      (entry) => entry.status === "Unassigned"
    );

    if (hasUnassignedStatus) {
      toast.error("Please assign a status to all billing entries", {
        description: "All entries must have a valid status selected.",
      });
      return false;
    }

    return true;
  };

  const handleNext = () => {
    let isValid = true;

    if (currentStep === 1) {
      isValid = validateStep1();
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
      contactNumber: "",
      propertyLocation: "",
      contractMonths: 6,
      rentStartDate: "",
      dueDay: "30th/31st - Last Day",
      rentAmount: 0,
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
    }> = [];

    const startDate = new Date(formData.rentStartDate);

    for (let i = 0; i < formData.contractMonths; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      // Apply the chosen due date logic
      switch (formData.dueDay) {
        case "30th/31st - Last Day":
          // Set to last day of month
          dueDate.setMonth(dueDate.getMonth() + 1);
          dueDate.setDate(0);
          break;
        case "15th - Mid Month":
          // Set to 15th of the month
          dueDate.setDate(15);
          break;
        case "1st - First Day":
          // Set to 1st of the month
          dueDate.setDate(1);
          break;
        default:
          // Fallback to last day of month
          dueDate.setMonth(dueDate.getMonth() + 1);
          dueDate.setDate(0);
      }

      const otherCharges = Math.floor(Math.random() * 15000) + 5000;

      // Format date for better display
      const formattedDate = dueDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      schedule.push({
        dueDate: formattedDate,
        rentDue: formData.rentAmount,
        otherCharges: otherCharges,
        grossDue: formData.rentAmount + otherCharges,
        status: "Unassigned",
      });
    }

    setFormData((prev) => ({ ...prev, billingSchedule: schedule }));
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const result = await submitPropertyData(formData);

      if (result.success && result.data) {
        // Show success toast
        toast.success("Property Added Successfully!", {
          description: `${formData.unitName} has been added to your portfolio.`,
        });

        // Pass the original form data instead of result.data
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
          contactNumber: "",
          propertyLocation: "",
          contractMonths: 0,
          rentStartDate: "",
          dueDay: "30th/31st - Last Day",
          rentAmount: 0,
          billingSchedule: [],
        });
      } else {
        // Show error toast
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
    // Clear error for this field when user starts typing
    if (errors[field as keyof ValidationErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const updateBillingStatus = (index: number, newStatus: string) => {
    setFormData((prev) => ({
      ...prev,
      billingSchedule: prev.billingSchedule.map((bill, i) =>
        i === index ? { ...bill, status: newStatus } : bill
      ),
    }));
  };

  const getStepInfo = (step: number) => {
    // For vacant properties, adjust step display
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
        <DialogContent className="w-[95vw] sm:w-[90vw] lg:w-[85vw] xl:w-[80vw] !max-w-[1400px] h-[95vh] overflow-hidden flex flex-col bg-background">
          {/* Enhanced Header with Dark Mode Support - Mobile Responsive */}
          <DialogHeader className="space-y-4 md:space-y-6 pb-4 md:pb-8 relative">
            <div
              className={`absolute inset-0 ${stepInfo.bgColor} rounded-t-lg -mx-4 md:-mx-6 -mt-4 md:-mt-6`}
            />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2 md:mb-4">
                <DialogTitle className="flex items-center gap-2 md:gap-4 text-lg md:text-3xl">
                  <div
                    className={`p-2 md:p-3 rounded-full ${stepInfo.bgColor} ${stepInfo.color} border ${stepInfo.borderColor}`}
                  >
                    {stepInfo.icon}
                  </div>
                  <div>
                    <div className="text-lg md:text-3xl font-bold text-foreground">
                      {stepInfo.title}
                    </div>
                    <div className="text-xs md:text-base font-normal text-muted-foreground mt-1 md:mt-2 hidden sm:block">
                      {stepInfo.description}
                    </div>
                  </div>
                </DialogTitle>
                <div className="text-right">
                  <div className="text-xs md:text-sm text-muted-foreground mb-1">
                    Progress
                  </div>
                  <div className="text-sm md:text-lg font-semibold text-foreground">
                    {currentStep} of {totalSteps}
                  </div>
                </div>
              </div>

              {/* Enhanced Progress Bar with Dark Mode - Mobile Responsive */}
              <div className="space-y-2 md:space-y-4">
                <div className="relative">
                  <div className="w-full bg-muted rounded-full h-2 md:h-4 shadow-inner">
                    <div
                      className="bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 h-2 md:h-4 rounded-full transition-all duration-700 ease-out shadow-lg"
                      style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                    />
                  </div>
                  {/* Step indicators */}
                  <div className="absolute top-0 w-full flex justify-between">
                    {Array.from({ length: totalSteps }, (_, i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 md:w-4 md:h-4 rounded-full border-2 transition-all duration-300 ${
                          i + 1 <= currentStep
                            ? "bg-background border-primary shadow-md"
                            : "bg-muted border-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-between text-xs md:text-sm font-medium text-muted-foreground">
                  <span
                    className={
                      currentStep >= 1 ? "text-blue-600 dark:text-blue-400" : ""
                    }
                  >
                    Unit Details
                  </span>
                  <span
                    className={
                      currentStep >= 2
                        ? "text-purple-600 dark:text-purple-400"
                        : ""
                    }
                  >
                    Setup
                  </span>
                  <span
                    className={
                      currentStep >= 3
                        ? "text-orange-600 dark:text-orange-400"
                        : ""
                    }
                  >
                    Review
                  </span>
                  <span
                    className={
                      currentStep >= 4
                        ? "text-green-600 dark:text-green-400"
                        : ""
                    }
                  >
                    Complete
                  </span>
                </div>
              </div>
            </div>
          </DialogHeader>

          <Separator className="my-1 md:my-2" />

          {/* Content Area with Navigation - Mobile Responsive */}
          <div className="flex-1 overflow-y-auto">
            <div className="py-4 md:py-8 px-1 md:px-2 pb-24 md:pb-32">
              {/* Validation Errors Alert */}
              {Object.keys(errors).length > 0 && (
                <Alert className="mb-4 md:mb-6 border-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please fix the following errors before proceeding:
                    <ul className="mt-2 list-disc list-inside text-sm">
                      {Object.entries(errors).map(([field, error]) => (
                        <li key={field}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {currentStep === 1 && (
                <div className="space-y-6 md:space-y-10">
                  <Card className="shadow-lg border bg-card">
                    <CardContent className="p-4 md:p-10">
                      <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                        <div className="p-2 md:p-3 rounded-full bg-blue-100 dark:bg-blue-950/50">
                          <Home className="h-4 w-4 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-lg md:text-2xl font-bold text-foreground">
                            Property Information
                          </h3>
                          <p className="text-sm md:text-base text-muted-foreground">
                            Enter the basic details of your property
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
                        <div className="space-y-3 md:space-y-4">
                          <Label
                            htmlFor="unitName"
                            className="text-sm md:text-lg font-semibold text-foreground"
                          >
                            Unit Name *
                          </Label>
                          <Input
                            id="unitName"
                            value={formData.unitName}
                            onChange={(e) =>
                              updateFormData("unitName", e.target.value)
                            }
                            placeholder="e.g., Unit 1, Apartment A, Office 201"
                            className={`h-12 md:h-14 text-sm md:text-lg border-2 rounded-xl bg-background ${
                              errors.unitName ? "border-destructive" : ""
                            }`}
                          />
                          {errors.unitName && (
                            <p className="text-sm text-destructive">
                              {errors.unitName}
                            </p>
                          )}
                          <p className="text-xs md:text-sm text-muted-foreground">
                            Give your property a clear, identifiable name
                          </p>
                        </div>

                        <div className="space-y-3 md:space-y-4">
                          <Label
                            htmlFor="propertyType"
                            className="text-sm md:text-lg font-semibold text-foreground"
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
                              className={`h-12 md:h-14 text-sm md:text-lg border-2 rounded-xl bg-background ${
                                errors.propertyType ? "border-destructive" : ""
                              }`}
                            >
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
                          {errors.propertyType && (
                            <p className="text-sm text-destructive">
                              {errors.propertyType}
                            </p>
                          )}
                          <p className="text-xs md:text-sm text-muted-foreground">
                            Choose the category that best describes your
                            property
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 md:mt-10">
                        <Label className="text-sm md:text-lg font-semibold text-foreground mb-3 md:mb-4 block">
                          Property Location *
                        </Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 md:left-4 top-4 md:top-5 h-4 w-4 md:h-6 md:w-6 text-muted-foreground" />
                          <textarea
                            value={formData.propertyLocation}
                            onChange={(e) =>
                              updateFormData("propertyLocation", e.target.value)
                            }
                            placeholder="Enter complete property address including street, city, and postal code..."
                            className={`w-full h-24 md:h-32 pl-10 md:pl-14 pr-4 md:pr-6 py-3 md:py-5 border-2 rounded-xl resize-none text-sm md:text-lg focus:ring-2 focus:ring-ring focus:border-ring transition-all bg-background text-foreground ${
                              errors.propertyLocation
                                ? "border-destructive"
                                : "border-input"
                            }`}
                          />
                        </div>
                        {errors.propertyLocation && (
                          <p className="text-sm text-destructive mt-1">
                            {errors.propertyLocation}
                          </p>
                        )}
                        <p className="text-xs md:text-sm text-muted-foreground mt-2">
                          Provide the complete address for accurate location
                          identification
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-lg border bg-card">
                    <CardContent className="p-4 md:p-10">
                      <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
                        <div className="p-2 md:p-3 rounded-full bg-green-100 dark:bg-green-950/50">
                          <User className="h-4 w-4 md:h-6 md:w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h3 className="text-lg md:text-2xl font-bold text-foreground">
                            Occupancy & Tenant Details
                          </h3>
                          <p className="text-sm md:text-base text-muted-foreground">
                            Specify current occupancy status and tenant
                            information
                          </p>
                        </div>
                      </div>

                      <div className="space-y-6 md:space-y-8">
                        <div className="space-y-4 md:space-y-6">
                          <Label className="text-sm md:text-lg font-semibold text-foreground">
                            Occupancy Status
                          </Label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                            <Button
                              type="button"
                              variant={
                                formData.occupancyStatus === "occupied"
                                  ? "default"
                                  : "outline"
                              }
                              size="lg"
                              className="h-16 md:h-20 flex flex-col items-center gap-1 md:gap-2 text-sm md:text-lg border-2 transition-all hover:scale-105"
                              onClick={() =>
                                updateFormData("occupancyStatus", "occupied")
                              }
                            >
                              <User className="h-5 w-5 md:h-7 md:w-7" />
                              <span>Currently Occupied</span>
                            </Button>
                            <Button
                              type="button"
                              variant={
                                formData.occupancyStatus === "vacant"
                                  ? "default"
                                  : "outline"
                              }
                              size="lg"
                              className="h-16 md:h-20 flex flex-col items-center gap-1 md:gap-2 text-sm md:text-lg border-2 transition-all hover:scale-105"
                              onClick={() =>
                                updateFormData("occupancyStatus", "vacant")
                              }
                            >
                              <Building className="h-5 w-5 md:h-7 md:w-7" />
                              <span>Available/Vacant</span>
                            </Button>
                          </div>
                        </div>

                        {formData.occupancyStatus === "occupied" && (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10 pt-6 md:pt-8 border-t-2 border-border">
                            <div className="space-y-3 md:space-y-4">
                              <Label
                                htmlFor="tenantName"
                                className="text-sm md:text-lg font-semibold text-foreground"
                              >
                                Tenant Full Name *
                              </Label>
                              <Input
                                id="tenantName"
                                value={formData.tenantName}
                                onChange={(e) =>
                                  updateFormData("tenantName", e.target.value)
                                }
                                placeholder="Enter tenant's complete name"
                                className={`h-12 md:h-14 text-sm md:text-lg border-2 rounded-xl bg-background ${
                                  errors.tenantName ? "border-destructive" : ""
                                }`}
                              />
                              {errors.tenantName && (
                                <p className="text-sm text-destructive">
                                  {errors.tenantName}
                                </p>
                              )}
                              <p className="text-xs md:text-sm text-muted-foreground">
                                Legal name as it appears on the lease agreement
                              </p>
                            </div>

                            <div className="space-y-3 md:space-y-4">
                              <Label
                                htmlFor="contactNumber"
                                className="text-sm md:text-lg font-semibold text-foreground"
                              >
                                Contact Number *
                              </Label>
                              <Input
                                id="contactNumber"
                                value={formData.contactNumber}
                                onChange={(e) =>
                                  updateFormData(
                                    "contactNumber",
                                    e.target.value
                                  )
                                }
                                placeholder="e.g., 09123456789"
                                className={`h-12 md:h-14 text-sm md:text-lg border-2 rounded-xl bg-background ${
                                  errors.contactNumber
                                    ? "border-destructive"
                                    : ""
                                }`}
                              />
                              {errors.contactNumber && (
                                <p className="text-sm text-destructive">
                                  {errors.contactNumber}
                                </p>
                              )}
                              <p className="text-xs md:text-sm text-muted-foreground">
                                Primary contact number for property-related
                                communications
                              </p>
                            </div>
                          </div>
                        )}

                        {formData.occupancyStatus === "vacant" && (
                          <div className="pt-6 md:pt-8 border-t-2 border-border">
                            <div className="max-w-md mx-auto space-y-4">
                              <div className="flex items-center gap-3 mb-4 justify-center">
                                <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                                <Label
                                  htmlFor="vacantRentAmount"
                                  className="text-lg md:text-xl font-semibold text-foreground"
                                >
                                  Expected Monthly Rent (₱) *
                                </Label>
                              </div>
                              <Input
                                id="vacantRentAmount"
                                type="number"
                                value={formData.rentAmount}
                                onChange={(e) =>
                                  updateFormData(
                                    "rentAmount",
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                placeholder="25000"
                                className={`h-14 md:h-16 text-lg md:text-xl border-2 rounded-xl bg-background text-center ${
                                  errors.rentAmount ? "border-destructive" : ""
                                }`}
                              />
                              {errors.rentAmount && (
                                <p className="text-sm text-destructive text-center">
                                  {errors.rentAmount}
                                </p>
                              )}
                              <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
                                <p className="text-sm text-green-700 dark:text-green-300 font-medium text-center">
                                  💰 Set the expected rental price for potential
                                  tenants
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Step 2: Billing Setup - Mobile Responsive */}
              {currentStep === 2 && formData.occupancyStatus === "occupied" && (
                <div className="space-y-6 md:space-y-10">
                  <div className="text-center space-y-3 md:space-y-4 mb-8 md:mb-12">
                    <div className="flex items-center justify-center gap-2 md:gap-3 mb-3 md:mb-4">
                      <div className="p-2 md:p-3 rounded-full bg-purple-100 dark:bg-purple-950/50">
                        <Calendar className="h-6 w-6 md:h-8 md:w-8 text-purple-600 dark:text-purple-400" />
                      </div>
                      <h2 className="text-xl md:text-3xl font-bold text-foreground">
                        Generate Initial Billing
                      </h2>
                    </div>
                    <p className="text-base md:text-xl text-muted-foreground px-4">
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        {formData.unitName}
                      </span>{" "}
                      • {formData.propertyType}
                    </p>
                  </div>

                  <Card className="shadow-lg border bg-card">
                    <CardContent className="p-4 md:p-10">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                        <div className="space-y-4 md:space-y-6">
                          <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                            <Clock className="h-4 w-4 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />
                            <Label
                              htmlFor="contractMonths"
                              className="text-sm md:text-lg font-semibold text-foreground"
                            >
                              Contract Duration (Months) *
                            </Label>
                          </div>
                          <Input
                            id="contractMonths"
                            type="number"
                            value={formData.contractMonths}
                            onChange={(e) =>
                              updateFormData(
                                "contractMonths",
                                parseInt(e.target.value) || 0
                              )
                            }
                            min="1"
                            max="24"
                            className={`h-12 md:h-14 text-sm md:text-lg border-2 rounded-xl bg-background ${
                              errors.contractMonths ? "border-destructive" : ""
                            }`}
                          />
                          {errors.contractMonths && (
                            <p className="text-sm text-destructive">
                              {errors.contractMonths}
                            </p>
                          )}
                          <div className="bg-purple-50 dark:bg-purple-950/30 p-3 md:p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                            <p className="text-xs md:text-sm text-purple-700 dark:text-purple-300 font-medium">
                              💡 Typical range: 6-12 months for residential,
                              12-24 months for commercial
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4 md:space-y-6">
                          <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                            <Calendar className="h-4 w-4 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />
                            <Label
                              htmlFor="rentStartDate"
                              className="text-sm md:text-lg font-semibold text-foreground"
                            >
                              Rent Start Date *
                            </Label>
                          </div>
                          <Input
                            id="rentStartDate"
                            type="date"
                            value={formData.rentStartDate}
                            onChange={(e) =>
                              updateFormData("rentStartDate", e.target.value)
                            }
                            className={`h-12 md:h-14 text-sm md:text-lg border-2 rounded-xl bg-background ${
                              errors.rentStartDate ? "border-destructive" : ""
                            }`}
                          />
                          {errors.rentStartDate && (
                            <p className="text-sm text-destructive">
                              {errors.rentStartDate}
                            </p>
                          )}
                          <div className="bg-purple-50 dark:bg-purple-950/30 p-3 md:p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                            <p className="text-xs md:text-sm text-purple-700 dark:text-purple-300 font-medium">
                              📅 This will be the first billing cycle date
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4 md:space-y-6">
                          <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                            <Calendar className="h-4 w-4 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />
                            <Label
                              htmlFor="dueDay"
                              className="text-sm md:text-lg font-semibold text-foreground"
                            >
                              Payment Due Date *
                            </Label>
                          </div>
                          <Select
                            value={formData.dueDay}
                            onValueChange={(value) =>
                              updateFormData("dueDay", value)
                            }
                          >
                            <SelectTrigger className="h-12 md:h-14 text-sm md:text-lg border-2 rounded-xl bg-background">
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
                          <div className="bg-purple-50 dark:bg-purple-950/30 p-3 md:p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                            <p className="text-xs md:text-sm text-purple-700 dark:text-purple-300 font-medium">
                              ⏰ When rent payments are due each month
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4 md:space-y-6">
                          <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                            <DollarSign className="h-4 w-4 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />
                            <Label
                              htmlFor="rentAmount"
                              className="text-sm md:text-lg font-semibold text-foreground"
                            >
                              Monthly Rent Amount (₱) *
                            </Label>
                          </div>
                          <Input
                            id="rentAmount"
                            type="number"
                            value={formData.rentAmount}
                            onChange={(e) =>
                              updateFormData(
                                "rentAmount",
                                parseInt(e.target.value) || 0
                              )
                            }
                            placeholder="25000"
                            className={`h-12 md:h-14 text-sm md:text-lg border-2 rounded-xl bg-background ${
                              errors.rentAmount ? "border-destructive" : ""
                            }`}
                          />
                          {errors.rentAmount && (
                            <p className="text-sm text-destructive">
                              {errors.rentAmount}
                            </p>
                          )}
                          <div className="bg-purple-50 dark:bg-purple-950/30 p-3 md:p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                            <p className="text-xs md:text-sm text-purple-700 dark:text-purple-300 font-medium">
                              💰 Base monthly rental fee (utilities and other
                              charges will be calculated separately)
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {currentStep === 3 && formData.occupancyStatus === "occupied" && (
                <div className="space-y-4 md:space-y-6">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 md:gap-3 mb-3 md:mb-4">
                      <div className="p-2 md:p-3 rounded-full bg-orange-100 dark:bg-orange-950/50">
                        <CreditCard className="h-4 w-4 md:h-6 md:w-6 text-orange-600 dark:text-orange-400" />
                      </div>
                      <h2 className="text-xl md:text-3xl font-bold text-foreground">
                        Generated Billing Schedule
                      </h2>
                    </div>
                    <p className="text-base md:text-xl text-muted-foreground px-4">
                      <span className="font-semibold text-orange-600 dark:text-orange-400">
                        {formData.unitName}
                      </span>{" "}
                      •
                      <span className="font-semibold text-orange-600 dark:text-orange-400">
                        {" "}
                        {formData.tenantName || "Vacant"}
                      </span>{" "}
                      • {formData.propertyType}
                    </p>
                  </div>

                  <Card className="shadow-xl border bg-card">
                    <CardContent className="p-0">
                      {/* Mobile: Stack layout, Desktop: Table layout */}
                      <div className="block md:hidden">
                        {/* Mobile Card Layout */}
                        <div className="space-y-3 p-4">
                          {formData.billingSchedule.map((bill, index) => (
                            <Card key={index} className="border">
                              <CardContent className="p-4">
                                <div className="space-y-3">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-muted-foreground">
                                      Due Date
                                    </span>
                                    <span className="font-semibold">
                                      {bill.dueDate}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-muted-foreground">
                                      Rent Due
                                    </span>
                                    <span className="font-medium text-green-600 dark:text-green-400">
                                      ₱{bill.rentDue.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-muted-foreground">
                                      Other Charges
                                    </span>
                                    <span className="font-medium text-blue-600 dark:text-blue-400">
                                      ₱{bill.otherCharges.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-muted-foreground">
                                      Gross Due
                                    </span>
                                    <span className="text-lg font-bold text-foreground">
                                      ₱{bill.grossDue.toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-muted-foreground">
                                      Status
                                    </span>
                                    <Select
                                      value={bill.status}
                                      onValueChange={(value) =>
                                        updateBillingStatus(index, value)
                                      }
                                    >
                                      <SelectTrigger
                                        className={`w-40 md:w-48 h-10 md:h-12 text-sm md:text-base ${
                                          bill.status === "Unassigned"
                                            ? "text-muted-foreground border-dashed"
                                            : ""
                                        }`}
                                      >
                                        <SelectValue>
                                          {bill.status === "Unassigned"
                                            ? "Select status"
                                            : bill.status}
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
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>

                      {/* Desktop Table Layout */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                              <th className="text-left p-4 md:p-8 font-bold text-sm md:text-lg">
                                Due Date
                              </th>
                              <th className="text-left p-4 md:p-8 font-bold text-sm md:text-lg">
                                Rent Due
                              </th>
                              <th className="text-left p-4 md:p-8 font-bold text-sm md:text-lg">
                                Other Charges
                              </th>
                              <th className="text-left p-4 md:p-8 font-bold text-sm md:text-lg">
                                Gross Due
                              </th>
                              <th className="text-left p-4 md:p-8 font-bold text-sm md:text-lg">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.billingSchedule.map((bill, index) => (
                              <tr
                                key={index}
                                className={`border-b-2 border-border hover:bg-muted/50 transition-all duration-200 ${
                                  index % 2 === 0
                                    ? "bg-background"
                                    : "bg-muted/20"
                                }`}
                              >
                                <td className="p-4 md:p-8 font-semibold text-sm md:text-lg text-foreground">
                                  {bill.dueDate}
                                </td>
                                <td className="p-4 md:p-8 text-sm md:text-lg font-medium text-green-600 dark:text-green-400">
                                  ₱{bill.rentDue.toLocaleString()}
                                </td>
                                <td className="p-4 md:p-8 text-sm md:text-lg font-medium text-blue-600 dark:text-blue-400">
                                  ₱{bill.otherCharges.toLocaleString()}
                                </td>
                                <td className="p-4 md:p-8 text-lg md:text-xl font-bold text-foreground">
                                  ₱{bill.grossDue.toLocaleString()}
                                </td>
                                <td className="p-4 md:p-8">
                                  <Select
                                    value={bill.status}
                                    onValueChange={(value) =>
                                      updateBillingStatus(index, value)
                                    }
                                  >
                                    <SelectTrigger
                                      className={`w-40 md:w-48 h-10 md:h-12 text-sm md:text-base ${
                                        bill.status === "Unassigned"
                                          ? "text-muted-foreground border-dashed"
                                          : ""
                                      }`}
                                    >
                                      <SelectValue>
                                        {bill.status === "Unassigned"
                                          ? "Select status"
                                          : bill.status}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectGroup>
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
                                      </SelectGroup>
                                    </SelectContent>
                                  </Select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Summary Section - Mobile Responsive */}
                      <div className="bg-orange-50 dark:bg-orange-950/30 p-4 md:p-8 border-t-2 border-orange-200 dark:border-orange-800">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 text-center">
                          <div>
                            <p className="text-xs md:text-sm text-muted-foreground mb-1">
                              Total Billing Periods
                            </p>
                            <p className="text-lg md:text-2xl font-bold text-orange-600 dark:text-orange-400">
                              {formData.billingSchedule.length}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs md:text-sm text-muted-foreground mb-1">
                              Monthly Base Rent
                            </p>
                            <p className="text-lg md:text-2xl font-bold text-green-600 dark:text-green-400">
                              ₱{formData.rentAmount.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs md:text-sm text-muted-foreground mb-1">
                              Contract Duration
                            </p>
                            <p className="text-lg md:text-2xl font-bold text-blue-600 dark:text-blue-400">
                              {formData.contractMonths} months
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Step 4: Enhanced Completion - Mobile Responsive */}
              {currentStep === totalSteps && (
                <div className="text-center space-y-6 md:space-y-10">
                  <div className="space-y-4 md:space-y-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-green-100 dark:bg-green-950/50 rounded-full blur-2xl opacity-50"></div>
                      <CheckCircle className="h-20 w-20 md:h-28 md:w-28 text-green-600 dark:text-green-400 mx-auto relative z-10" />
                    </div>
                    <h2 className="text-2xl md:text-4xl font-bold text-green-600 dark:text-green-400">
                      Property Added Successfully!
                    </h2>
                    <p className="text-base md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
                      🎉 Congratulations! Your new property has been
                      successfully added to your portfolio
                      {formData.occupancyStatus === "occupied" &&
                        " with a complete billing schedule"}
                    </p>
                  </div>

                  <Card className="max-w-4xl mx-auto shadow-xl border bg-card">
                    <CardContent className="p-6 md:p-12">
                      <h3 className="text-xl md:text-2xl font-bold mb-6 md:mb-10 text-center text-foreground">
                        Property Summary
                      </h3>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                        <div className="space-y-6 md:space-y-8">
                          <div className="bg-background p-4 md:p-6 rounded-xl shadow-md border">
                            <span className="text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-wide">
                              Unit Name
                            </span>
                            <p className="text-lg md:text-2xl font-bold text-foreground mt-2">
                              {formData.unitName}
                            </p>
                          </div>
                          <div className="bg-background p-4 md:p-6 rounded-xl shadow-md border">
                            <span className="text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-wide">
                              Property Type
                            </span>
                            <p className="text-base md:text-xl font-semibold text-foreground mt-2">
                              {formData.propertyType}
                            </p>
                          </div>
                          <div className="bg-background p-4 md:p-6 rounded-xl shadow-md border">
                            <span className="text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-wide">
                              Status
                            </span>
                            <p className="text-base md:text-xl font-semibold text-foreground mt-2 capitalize">
                              {formData.occupancyStatus === "vacant" ? (
                                <span className="text-orange-600 dark:text-orange-400">
                                  Available for Rent
                                </span>
                              ) : (
                                <span className="text-blue-600 dark:text-blue-400">
                                  Currently Occupied
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-6 md:space-y-8">
                          <div className="bg-background p-4 md:p-6 rounded-xl shadow-md border border-green-200 dark:border-green-800">
                            <span className="text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-wide">
                              {formData.occupancyStatus === "vacant"
                                ? "Expected Monthly Rent"
                                : "Monthly Rent"}
                            </span>
                            <p className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                              ₱{formData.rentAmount.toLocaleString()}
                            </p>
                          </div>

                          {formData.occupancyStatus === "occupied" ? (
                            <>
                              <div className="bg-background p-4 md:p-6 rounded-xl shadow-md border">
                                <span className="text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-wide">
                                  Tenant
                                </span>
                                <p className="text-base md:text-xl font-semibold text-foreground mt-2">
                                  {formData.tenantName}
                                </p>
                              </div>
                              <div className="bg-background p-4 md:p-6 rounded-xl shadow-md border">
                                <span className="text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-wide">
                                  Billing Entries
                                </span>
                                <p className="text-base md:text-xl font-semibold text-foreground mt-2">
                                  {formData.billingSchedule.length} entries
                                  generated
                                </p>
                              </div>
                            </>
                          ) : (
                            <div className="bg-background p-4 md:p-6 rounded-xl shadow-md border border-orange-200 dark:border-orange-800">
                              <span className="text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-wide">
                                Property Location
                              </span>
                              <p className="text-sm md:text-base font-semibold text-foreground mt-2">
                                {formData.propertyLocation}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* Fixed Navigation at Bottom - Mobile Responsive */}
            <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-3 md:p-6">
              <div className="max-w-[1400px] mx-auto flex justify-between items-center">
                {/* Left Button - Cancel on Step 1, Previous on others */}
                {currentStep === 1 ? (
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    size="sm"
                    className="px-4 md:px-12 py-3 md:py-6 text-sm md:text-lg border-2 hover:scale-105 transition-all"
                  >
                    <X className="h-4 w-4 md:h-5 md:w-5 mr-1 md:mr-2" />
                    Cancel
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    size="sm"
                    className="px-4 md:px-12 py-3 md:py-6 text-sm md:text-lg border-2 hover:scale-105 transition-all"
                  >
                    ← Previous
                  </Button>
                )}

                {/* Center Progress Dots */}
                <div className="flex gap-2 md:gap-3">
                  {Array.from({ length: totalSteps }, (_, i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 md:w-4 md:h-4 rounded-full transition-all duration-300 ${
                        i + 1 <= currentStep
                          ? "bg-gradient-to-r from-blue-500 to-green-500 shadow-lg scale-110"
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>

                {/* Right Button */}
                {currentStep < totalSteps ? (
                  <Button
                    onClick={handleNext}
                    size="sm"
                    disabled={isSubmitting}
                    className="px-4 md:px-12 py-3 md:py-6 text-sm md:text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 hover:scale-105 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {currentStep === 2 &&
                    formData.occupancyStatus === "occupied"
                      ? "Generate →"
                      : (currentStep === 1 &&
                          formData.occupancyStatus === "vacant") ||
                        (currentStep === 3 &&
                          formData.occupancyStatus === "occupied")
                      ? "Review & Add →"
                      : "Next →"}
                  </Button>
                ) : (
                  <Button
                    onClick={handleComplete}
                    size="sm"
                    disabled={isSubmitting}
                    className="px-4 md:px-12 py-3 md:py-6 text-sm md:text-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 hover:scale-105 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Submitting...
                      </>
                    ) : (
                      "Complete ✓"
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-xl md:text-2xl">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-950/50">
                <Building className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              Confirm Property Addition
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-4">
                <p className="text-base text-muted-foreground">
                  Please review the property details before adding it to your
                  portfolio:
                </p>

                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Unit Name:
                      </span>
                      <p className="font-semibold text-foreground">
                        {formData.unitName}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Property Type:
                      </span>
                      <p className="font-semibold text-foreground">
                        {formData.propertyType}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Status:
                      </span>
                      <p className="font-semibold capitalize">
                        {formData.occupancyStatus === "vacant" ? (
                          <span className="text-orange-600 dark:text-orange-400">
                            Available for Rent
                          </span>
                        ) : (
                          <span className="text-blue-600 dark:text-blue-400">
                            Currently Occupied
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">
                        {formData.occupancyStatus === "vacant"
                          ? "Expected"
                          : "Monthly"}{" "}
                        Rent:
                      </span>
                      <p className="font-bold text-green-600 dark:text-green-400">
                        ₱{formData.rentAmount.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {formData.occupancyStatus === "occupied" && (
                    <div className="border-t pt-3 mt-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">
                            Tenant:
                          </span>
                          <p className="font-semibold text-foreground">
                            {formData.tenantName}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">
                            Contract Duration:
                          </span>
                          <p className="font-semibold text-foreground">
                            {formData.contractMonths} months
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">
                            Billing Entries:
                          </span>
                          <p className="font-semibold text-foreground">
                            {formData.billingSchedule.length} entries
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">
                            Start Date:
                          </span>
                          <p className="font-semibold text-foreground">
                            {formData.rentStartDate
                              ? new Date(
                                  formData.rentStartDate
                                ).toLocaleDateString()
                              : "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.occupancyStatus === "vacant" && (
                    <div className="border-t pt-3 mt-3">
                      <div>
                        <span className="text-sm font-medium text-muted-foreground">
                          Location:
                        </span>
                        <p className="font-semibold text-foreground text-sm">
                          {formData.propertyLocation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        Ready to Add Property
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        {formData.occupancyStatus === "vacant"
                          ? "This vacant property will be added to your portfolio and made available for rental."
                          : "This occupied property will be added with a complete billing schedule ready for management."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel
              onClick={handleCancelConfirmation}
              className="px-6 py-2"
            >
              Review Details
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {isSubmitting ? "Adding..." : "Add Property"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
