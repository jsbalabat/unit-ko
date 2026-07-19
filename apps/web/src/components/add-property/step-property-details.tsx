"use client";

import { Home, MapPin, User } from "lucide-react";
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
import { TenantFields } from "@/components/add-property/tenant-fields";
import { IntentToggle } from "@/components/add-property/intent-toggle";
import { SectionHeader } from "@/components/add-property/section-header";
import type {
  PropertyFormData,
  TenantInfo,
  ValidationErrors,
} from "@/components/add-property/form-types";

interface StepPropertyDetailsProps {
  formData: PropertyFormData;
  errors: ValidationErrors;
  isAddingTenants: boolean;
  updateFormData: (field: keyof PropertyFormData, value: unknown) => void;
  setMaxTenants: (value: number) => void;
  updateTenant: (
    index: number,
    field: keyof TenantInfo,
    value: string | number,
  ) => void;
}

export function StepPropertyDetails({
  formData,
  errors,
  isAddingTenants,
  updateFormData,
  setMaxTenants,
  updateTenant,
}: StepPropertyDetailsProps) {
  return (
    <div className="space-y-4">
      <Card className="shadow-sm border">
        <CardContent className="p-3 md:p-5">
          <IntentToggle
            value={formData.intent}
            error={errors.intent}
            onChange={(intent) => updateFormData("intent", intent)}
          />
        </CardContent>
      </Card>

      {/* The rest of the form stays hidden until the branch is chosen: the
          fields below differ by path, and showing them first invites filling in
          answers the other path would throw away. */}
      {!formData.intent ? null : (
      <>
      <Card className="shadow-sm border">
        <CardContent className="p-3 md:p-5">
          <SectionHeader
            icon={Home}
            title="Property Information"
            description="Basic property details"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unitName" className="text-sm font-medium">
                Unit Name *
              </Label>
              <Input
                id="unitName"
                value={formData.unitName}
                onChange={(e) => updateFormData("unitName", e.target.value)}
                placeholder="e.g., Unit 101, Office 3B"
                className={`h-9 text-sm ${
                  errors.unitName ? "border-destructive" : ""
                }`}
              />
              {errors.unitName && (
                <p className="text-xs text-destructive">{errors.unitName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="propertyType" className="text-sm font-medium">
                Property Type *
              </Label>
              <Select
                value={formData.propertyType}
                onValueChange={(value) => updateFormData("propertyType", value)}
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
          <SectionHeader
            icon={User}
            title={isAddingTenants ? "Tenants" : "Capacity"}
            description={
              isAddingTenants
                ? "How many the unit holds, and who is moving in"
                : "How many the unit holds, and the asking rent"
            }
          />

          <div className="space-y-4">
            <TenantFields
              formData={formData}
              errors={errors}
              updateFormData={updateFormData}
              setMaxTenants={setMaxTenants}
              updateTenant={updateTenant}
            />

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
                    Saved as vacant — this is the asking rent for the listing.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}
