"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import {
  Calendar,
  Building,
  CreditCard,
  CheckCircle,
  ChevronDown,
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
import { cn } from "@/lib/utils";

import type { PropertyFormData } from "@/components/add-property/form-types";
import { PropertyPreview } from "@/components/add-property/property-preview";
import { StepPropertyDetails } from "@/components/add-property/step-property-details";
import { StepBillingSetup } from "@/components/add-property/step-billing-setup";
import { StepBillingSchedule } from "@/components/add-property/step-billing-schedule";
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
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The wizard's data, derivations and syncs live here; this component keeps
  // only step navigation and the submit/confirm flow.
  const {
    formData,
    errors,
    setErrors,
    isAddingTenants,
    isPristine,
    updateFormData,
    setMaxTenants,
    updateTenant,
    setBillingSchedule,
    reset: resetForm,
    generateBillingSchedule,
    validateStep1,
    validateStep2,
    validateBillingSchedule,
    validateTenants,
  } = usePropertyForm();

  // Tenant steps (lease terms, billing) only exist when tenants are being added.
  const totalSteps = isAddingTenants ? 4 : 2;

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

  // Dismissing the dialog (Escape, clicking outside) deliberately keeps the
  // draft and the step, so a mis-click doesn't cost a half-filled form.
  // Discarding is the explicit path, and it's the only one that resets.
  const handleDiscardClick = () => {
    if (isPristine) {
      discardAndClose();
      return;
    }
    setShowDiscardConfirm(true);
  };

  const discardAndClose = () => {
    setShowDiscardConfirm(false);
    setCurrentStep(1);
    resetForm();
    onClose();
  };

  // Keeps formData and currentStep so reopening resumes where the landlord
  // stopped. The draft only survives because this component stays mounted —
  // if the dialog is ever changed to unmount on close, this silently becomes a
  // discard, so move the draft above the dialog before doing that.
  const keepDraftAndClose = () => {
    setShowDiscardConfirm(false);
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


  // One accent for the whole wizard. The per-step palette this replaced
  // (blue → purple → orange → green) implied the steps were different kinds of
  // thing; they're four parts of one task, and the icon already distinguishes
  // them. The final step keeps its own treatment because "done" is genuinely a
  // different state, not just the next screen.
  const getStepInfo = (step: number) => {
    const isFinalStep = step === totalSteps;

    if (isFinalStep) {
      return {
        icon: <CheckCircle className="h-5 w-5 md:h-7 md:w-7" />,
        title: isAddingTenants ? "Ready to Add" : "Complete",
        description: "Review the details and add this property to your portfolio",
      };
    }

    switch (step) {
      case 1:
        return {
          icon: <Building className="h-5 w-5 md:h-7 md:w-7" />,
          title: "Property Details",
          description: isAddingTenants
            ? "Basic property information and tenant details"
            : "Basic property information and rental price",
        };
      case 2:
        return {
          icon: <Calendar className="h-5 w-5 md:h-7 md:w-7" />,
          title: "Billing Setup",
          description: "Configure rental terms and payment schedule",
        };
      case 3:
        return {
          icon: <CreditCard className="h-5 w-5 md:h-7 md:w-7" />,
          title: "Billing Schedule",
          description:
            formData.billingType === "blank"
              ? "Create custom billing entries and set accounting details"
              : "Review and confirm the generated billing table",
        };
      default:
        return { icon: null, title: "", description: "" };
    }
  };

  const stepInfo = getStepInfo(currentStep);
  const isFinalStep = currentStep === totalSteps;

  return (
    <>
      {/* Every way out goes through the discard prompt — dismissing the dialog
          by clicking away or pressing Escape is treated the same as pressing
          Discard, so a stray click can't quietly abandon a filled form. */}
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) handleDiscardClick();
        }}
      >
        <DialogContent className="w-[95vw] sm:w-[90vw] lg:max-w-7xl !max-w-[1600px] h-[90vh] max-h-[900px] overflow-hidden flex flex-col bg-background p-0 [&>button]:hidden">
          <div className="w-full border-b bg-muted/30 px-4 py-3 md:px-6 md:py-4">
            <DialogHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-lg md:text-2xl">
                  <div
                    className={cn(
                      "rounded-md border bg-background p-1.5 md:p-2",
                      isFinalStep
                        ? "text-green-600 dark:text-green-500"
                        : "text-primary",
                    )}
                  >
                    {stepInfo.icon}
                  </div>
                  <span>{stepInfo.title}</span>
                </DialogTitle>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs md:text-sm font-medium opacity-80">
                      Progress
                    </div>
                    <div className="text-sm md:text-base font-semibold">
                      {currentStep} of {totalSteps}
                    </div>
                  </div>
                  {/* The radix close button is hidden, so this stands in for
                      it — and goes through the same discard prompt. */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDiscardClick}
                    aria-label="Discard and close"
                    className="h-8 w-8 p-0 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <DialogDescription className="text-xs text-muted-foreground md:text-sm">
                {stepInfo.description} · Fields marked * are required.
              </DialogDescription>

              {/* Position is already carried by "N of M" above and the dots in
                  the nav bar; a third indicator overlaid on the bar was noise. */}
              <div className="mt-1 h-1.5 w-full rounded-full bg-background md:h-2">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-700 ease-out md:h-2",
                    isFinalStep ? "bg-green-600" : "bg-primary",
                  )}
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                />
              </div>
            </DialogHeader>
          </div>

          {/* Split-pane Content Area */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left Side - Form Fields */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 lg:border-r">
              {/* Below lg the preview column doesn't render at all, which left
                  phone users with no running summary of what they'd entered.
                  Collapsed by default so it costs no vertical space until asked
                  for — screen height is the scarce resource here, not width. */}
              <div className="lg:hidden">
                <button
                  type="button"
                  onClick={() => setShowMobilePreview((prev) => !prev)}
                  aria-expanded={showMobilePreview}
                  className="mb-3 flex w-full items-center gap-1.5 rounded-md border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform",
                      !showMobilePreview && "-rotate-90",
                    )}
                  />
                  {showMobilePreview ? "Hide" : "Show"} summary so far
                </button>
                {showMobilePreview && (
                  <div className="mb-4 rounded-lg border bg-muted/20 p-3">
                    <PropertyPreview
                      formData={formData}
                      currentStep={currentStep}
                    />
                  </div>
                )}
              </div>

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

              {currentStep === 3 && isAddingTenants && (
                <StepBillingSchedule
                  formData={formData}
                  updateFormData={updateFormData}
                  setBillingSchedule={setBillingSchedule}
                />
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
            {/* Discard sits on every step: abandoning a form is just as likely
                on step 3 as on step 1, and Back alone left no way out. */}
            <div className="flex items-center gap-1">
              {currentStep > 1 && (
                <Button
                  variant="ghost"
                  onClick={handlePrevious}
                  size="sm"
                  className="text-xs"
                >
                  ← Back
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={handleDiscardClick}
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Discard
              </Button>
            </div>

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

      {/* A Dialog rather than an AlertDialog on purpose: AlertDialog forces an
          explicit choice and blocks outside clicks, but here dismissing means
          "keep editing" — the safe answer — so letting a click away close it is
          the friendlier default. */}
      <Dialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              Leave without adding this property?
            </DialogTitle>
            <DialogDescription>
              You can close this and pick up where you left off, or discard it
              and start over. Discarding can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {/* sm:justify-between separates the destructive action from the two
              safe ones, so Discard isn't adjacent to the button most people
              want. */}
          <DialogFooter className="sm:justify-between">
            <Button
              size="sm"
              variant="ghost"
              onClick={discardAndClose}
              className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              Discard
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setShowDiscardConfirm(false)}
              >
                Keep editing
              </Button>
              <Button size="sm" className="text-xs" onClick={keepDraftAndClose}>
                Save draft &amp; close
              </Button>
            </div>
          </DialogFooter>
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

    </>
  );
}
