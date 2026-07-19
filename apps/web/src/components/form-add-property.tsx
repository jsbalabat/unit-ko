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
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar,
  Building,
  CreditCard,
  CheckCircle,
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

import type { PropertyFormData } from "@/components/add-property/form-types";
import { formatShortDate } from "@/components/add-property/format";
import { PropertyPreview } from "@/components/add-property/property-preview";
import { StepPropertyDetails } from "@/components/add-property/step-property-details";
import { StepBillingSetup } from "@/components/add-property/step-billing-setup";
import { StepComplete } from "@/components/add-property/step-complete";
import { usePropertyForm } from "@/hooks/usePropertyForm";

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
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOtherChargesPopupOpen, setIsOtherChargesPopupOpen] = useState(false);
  const [selectedBillingIndex, setSelectedBillingIndex] = useState<
    number | null
  >(null);
  const [editingRentIndex, setEditingRentIndex] = useState<number | null>(null);
  const [editingRentValue, setEditingRentValue] = useState<number>(0);
  const [editingDateIndex, setEditingDateIndex] = useState<number | null>(null);
  const [editingDateValue, setEditingDateValue] = useState<string>("");

  // The wizard's data, derivations and syncs live here; this component keeps
  // only step navigation and its own popup/editing state.
  const {
    formData,
    setFormData,
    errors,
    setErrors,
    isAddingTenants,
    updateFormData,
    setMaxTenants,
    updateTenant,
    reset: resetForm,
    generateBillingSchedule,
    validateStep1,
    validateStep2,
    validateBillingSchedule,
    validateTenants,
  } = usePropertyForm();

  // Tenant steps (lease terms, billing) only exist when tenants are being added.
  const totalSteps = isAddingTenants ? 4 : 2;



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
    resetForm();
    onClose();
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
        resetForm();
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
                <StepPropertyDetails
                  formData={formData}
                  errors={errors}
                  isAddingTenants={isAddingTenants}
                  updateFormData={updateFormData}
                  setMaxTenants={setMaxTenants}
                  updateTenant={updateTenant}
                />
              )}

              {currentStep === 2 && isAddingTenants && (
                <StepBillingSetup
                  formData={formData}
                  errors={errors}
                  updateFormData={updateFormData}
                />
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
                                              ? formatShortDate(bill.dueDate)
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
                                      <span>{formatShortDate(bill.dueDate)}</span>
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

              {currentStep === totalSteps && (
                <StepComplete
                  formData={formData}
                  isAddingTenants={isAddingTenants}
                />
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
