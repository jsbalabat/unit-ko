"use client";

import { useState } from "react";
import { toast } from "sonner";
import type {
  PropertyFormData,
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
import {
  buildBillingSchedule,
  scheduleInputsKey,
} from "@/components/add-property/schedule";

export const EMPTY_PROPERTY_FORM: PropertyFormData = {
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
};

/**
 * Owns the add-property wizard's data: the form state, the derived flags, the
 * two render-phase syncs, and the bridge from the pure rules in
 * ./components/add-property to component state.
 *
 * Step navigation and per-popup UI state stay with the component — this hook
 * knows nothing about which step is showing.
 */
export function usePropertyForm() {
  const [formData, setFormData] = useState<PropertyFormData>(
    EMPTY_PROPERTY_FORM,
  );
  const [errors, setErrors] = useState<ValidationErrors>({});
  // Which inputs the current billingSchedule was built from; null = never built.
  const [scheduleGeneratedFrom, setScheduleGeneratedFrom] = useState<
    string | null
  >(null);

  const isAddingTenants = deriveIsAddingTenants(formData);

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
  // count. rentAmount is the property total (properties.rent_amount);
  // rentPerCollection is what each tenant's lease and invoices carry.
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

  const updateFormData = (field: keyof PropertyFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field as keyof ValidationErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const reset = () => {
    setFormData(EMPTY_PROPERTY_FORM);
    setErrors({});
    setScheduleGeneratedFrom(null);
  };

  // Rebuilding wipes every per-period edit made on the review step (other
  // charges, hand-set rents and dates), so an unchanged schedule is left alone —
  // otherwise stepping back to Billing and forward again silently discards them.
  const generateBillingSchedule = () => {
    const inputsKey = scheduleInputsKey(formData);
    if (inputsKey === scheduleGeneratedFrom && formData.billingSchedule.length) {
      return;
    }

    const result = buildBillingSchedule(formData, new Date());

    if (!result.ok) {
      toast.error(result.reason);
      return;
    }

    setFormData((prev) => ({ ...prev, billingSchedule: result.periods }));
    setScheduleGeneratedFrom(inputsKey);

    const frequencyLabel =
      formData.formBasis.charAt(0).toUpperCase() + formData.formBasis.slice(1);
    toast.success(`${frequencyLabel} billing schedule generated`, {
      description: `${result.periods.length} billing entries created`,
    });
  };

  // The rules live in ./add-property/validation (pure, unit-tested); these
  // wrappers only bridge them to component state.
  const runValidation = (rule: (data: PropertyFormData) => ValidationErrors) => {
    const newErrors = rule(formData);
    setErrors(newErrors);
    return isValid(newErrors);
  };

  return {
    formData,
    setFormData,
    errors,
    setErrors,
    isAddingTenants,
    updateFormData,
    reset,
    generateBillingSchedule,
    validateStep1: () => runValidation(checkStep1),
    validateStep2: () => runValidation(checkStep2),
    validateBillingSchedule: () => runValidation(checkBillingSchedule),
    validateTenants: () => runValidation(checkTenants),
  };
}
