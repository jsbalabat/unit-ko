"use client";

import { Calendar, Clock, DollarSign } from "lucide-react";
import { Input } from "@/components/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CollectionSchedulePicker } from "@/components/add-property/collection-schedule-picker";
import type {
  PropertyFormData,
  ValidationErrors,
} from "@/components/add-property/form-types";

interface StepBillingSetupProps {
  formData: PropertyFormData;
  errors: ValidationErrors;
  updateFormData: (field: keyof PropertyFormData, value: unknown) => void;
}

const FREQUENCIES = [
  "weekly",
  "bi-weekly",
  "monthly",
  "quarterly",
  "semi-annually",
  "annually",
];

const CHOICE_BUTTON =
  "h-9 px-3 text-sm font-medium rounded-md border transition-all";

export function StepBillingSetup({
  formData,
  errors,
  updateFormData,
}: StepBillingSetupProps) {
  const frequencyLabel =
    formData.formBasis.charAt(0).toUpperCase() + formData.formBasis.slice(1);

  return (
    <div className="space-y-4">
      <div className="bg-purple-50/50 dark:bg-purple-950/20 p-2 rounded-lg border border-purple-100 dark:border-purple-900/50 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <div className="p-1 rounded-full bg-purple-100 dark:bg-purple-900/50">
            <Calendar className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
            Setting up billing for{" "}
            <span className="font-semibold">{formData.unitName}</span>
          </p>
        </div>
      </div>

      <Card className="shadow-sm border">
        <CardContent className="p-3 md:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm font-medium">Billing Template *</Label>
              <div className="grid grid-cols-2 gap-2 max-w-sm">
                <button
                  type="button"
                  onClick={() => updateFormData("billingType", "pre-organized")}
                  className={cn(
                    CHOICE_BUTTON,
                    formData.billingType === "pre-organized"
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background border-input hover:bg-muted",
                  )}
                >
                  Pre-organized
                </button>
                <button
                  type="button"
                  onClick={() => updateFormData("billingType", "blank")}
                  className={cn(
                    CHOICE_BUTTON,
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
                      errors.contractMonths ? "border-destructive" : ""
                    }`}
                  />
                  {errors.contractMonths && (
                    <p className="text-xs text-destructive">
                      {errors.contractMonths}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Number of billing periods based on frequency below (e.g., 12
                    monthly periods = 1 year)
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
                      updateFormData("rentStartDate", e.target.value)
                    }
                    placeholder="Select start date"
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
                    When rent collection begins
                  </p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-purple-600" />
                    Frequency Basis *
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {FREQUENCIES.map((basis) => (
                      <button
                        key={basis}
                        type="button"
                        onClick={() => updateFormData("formBasis", basis)}
                        className={cn(
                          "h-9 px-2 text-xs font-medium rounded-md border transition-all",
                          formData.formBasis === basis
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background border-input hover:bg-muted",
                        )}
                      >
                        {basis.charAt(0).toUpperCase() + basis.slice(1)}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select billing frequency
                  </p>
                </div>

                <CollectionSchedulePicker
                  formData={formData}
                  updateFormData={updateFormData}
                />

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
                  When rent collection begins. Billing schedule will be managed
                  manually.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {formData.billingType === "pre-organized" && formData.rentStartDate && (
        <Card className="bg-muted/20 border-dashed">
          <CardContent className="p-3 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">
                Collection Schedule Preview
              </h3>
              <div className="text-xs text-muted-foreground">
                {frequencyLabel} basis
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Frequency:</span>
                <span className="font-medium">{frequencyLabel}</span>
              </div>
              {formData.formBasis === "weekly" && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Collection Day:</span>
                  <span className="font-medium">
                    {formData.collectionDay.charAt(0).toUpperCase() +
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
  );
}
