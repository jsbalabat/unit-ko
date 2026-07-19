"use client";

import { User, AlertCircle } from "lucide-react";
import { Input } from "@/components/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type {
  PropertyFormData,
  TenantInfo,
  ValidationErrors,
} from "@/components/add-property/form-types";

interface TenantFieldsProps {
  formData: PropertyFormData;
  errors: ValidationErrors;
  updateFormData: (field: keyof PropertyFormData, value: unknown) => void;
  setMaxTenants: (value: number) => void;
  updateTenant: (
    index: number,
    field: keyof TenantInfo,
    value: string | number,
  ) => void;
}

/**
 * Capacity and tenant identity entry for step 1. Whether the property counts as
 * occupied is derived from what's typed here, so this block is never gated on
 * occupancy — leaving it empty is how a vacant property gets created.
 */
export function TenantFields({
  formData,
  errors,
  updateFormData,
  setMaxTenants,
  updateTenant,
}: TenantFieldsProps) {
  return (
    <div className="space-y-4">
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
            setMaxTenants(
              e.target.value === "" ? 0 : parseInt(e.target.value) || 0,
            )
          }
          placeholder="Enter number of tenants"
          className={`h-9 text-sm ${
            errors.maxTenants ? "border-destructive" : ""
          }`}
        />
        {errors.maxTenants && (
          <p className="text-xs text-destructive">{errors.maxTenants}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Number of tenant slots/bed spaces in this property (minimum 1, maximum
          20)
        </p>
      </div>

      <p className="text-xs text-muted-foreground -mt-2">
        Occupancy is auto-derived from tenant entries: leave this section empty
        to create a vacant property, or fill in tenant details to mark it
        occupied. Capacity above is record-keeping only — you can add tenants
        past it.
      </p>

      <div className="space-y-4 pt-3 border-t border-border">
        {formData.maxTenants > 1 && (
          <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-xs text-blue-800 dark:text-blue-300">
              <strong>Bed Space Mode:</strong> You can add up to{" "}
              {formData.maxTenants} tenants. Fill in details for occupied slots
              (optional for vacant slots).
            </AlertDescription>
          </Alert>
        )}

        {formData.maxTenants === 1 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tenantName" className="text-sm font-medium">
                Tenant Name *
              </Label>
              <Input
                id="tenantName"
                value={formData.tenantName}
                onChange={(e) => updateFormData("tenantName", e.target.value)}
                placeholder="Tenant's full name"
                className={`h-9 text-sm ${
                  errors.tenantName ? "border-destructive" : ""
                }`}
              />
              {errors.tenantName && (
                <p className="text-xs text-destructive">{errors.tenantName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenantEmail" className="text-sm font-medium">
                Email Address *
              </Label>
              <Input
                id="tenantEmail"
                type="email"
                value={formData.tenantEmail}
                onChange={(e) => updateFormData("tenantEmail", e.target.value)}
                placeholder="tenant@example.com"
                className={`h-9 text-sm ${
                  errors.tenantEmail ? "border-destructive" : ""
                }`}
              />
              {errors.tenantEmail && (
                <p className="text-xs text-destructive">{errors.tenantEmail}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactNumber" className="text-sm font-medium">
                Contact Number *
              </Label>
              <Input
                id="contactNumber"
                value={formData.contactNumber}
                onChange={(e) => updateFormData("contactNumber", e.target.value)}
                placeholder="e.g., 09123456789"
                className={`h-9 text-sm ${
                  errors.contactNumber ? "border-destructive" : ""
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
          <div className="space-y-4">
            {formData.tenants.map((tenant, index) => (
              <Card key={index} className="border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      Tenant Slot #{index + 1}
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {tenant.tenantName ? "Occupied" : "Vacant"}
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
                          updateTenant(index, "tenantName", e.target.value)
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
                          updateTenant(index, "tenantEmail", e.target.value)
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
                          updateTenant(index, "contactNumber", e.target.value)
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
    </div>
  );
}
