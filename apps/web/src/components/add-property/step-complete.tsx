"use client";

import { CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { PropertyFormData } from "@/components/add-property/form-types";

interface StepCompleteProps {
  formData: PropertyFormData;
  isAddingTenants: boolean;
}

/** Final review before submit; read-only summary, no inputs. */
export function StepComplete({ formData, isAddingTenants }: StepCompleteProps) {
  return (
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
              <span className="text-xs text-muted-foreground">Property</span>
              <span className="text-sm font-medium">{formData.unitName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Type</span>
              <span className="text-sm">{formData.propertyType}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Status</span>
              <span className="text-sm font-medium capitalize">
                {!isAddingTenants ? (
                  <span className="text-orange-600">Available</span>
                ) : (
                  <span className="text-blue-600">Occupied</span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Rent</span>
              <span className="text-sm font-medium text-green-600">
                ₱{formData.rentAmount.toLocaleString()}
              </span>
            </div>

            {isAddingTenants && (
              <>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Tenant</span>
                  <span className="text-sm">{formData.tenantName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    Duration
                  </span>
                  <span className="text-sm">
                    {formData.contractMonths}{" "}
                    {formData.contractMonths === 1 ? "period" : "periods"}
                    {formData.formBasis && ` (${formData.formBasis})`}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
