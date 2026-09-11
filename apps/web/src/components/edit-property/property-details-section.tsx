"use client";

import { Building } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PropertyFormData } from "./types";

interface PropertyDetailsSectionProps {
  formData: PropertyFormData;
  isLocked: boolean;
  onChange: (field: keyof PropertyFormData, value: string | number) => void;
}

export function PropertyDetailsSection({
  formData,
  isLocked,
  onChange,
}: PropertyDetailsSectionProps) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-4 flex items-center">
        <Building className="mr-2 h-4 w-4" />
        Property Details
      </h2>
      <Card>
        <CardContent className="p-3 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="unitName">Unit Name</Label>
              <Input
                id="unitName"
                value={formData.unitName ?? ""}
                onChange={(e) => onChange("unitName", e.target.value)}
                disabled={isLocked}
                placeholder="e.g., Unit 101, Office 3B"
                className={isLocked ? "opacity-70" : ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="propertyType">Property Type</Label>
              <Select
                value={formData.propertyType}
                onValueChange={(value) => onChange("propertyType", value)}
                disabled={isLocked}
              >
                <SelectTrigger className={isLocked ? "opacity-70" : ""}>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="rentAmount">Monthly Rent Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5">₱</span>
                <Input
                  id="rentAmount"
                  type="number"
                  className={`pl-7 ${isLocked ? "opacity-70" : ""}`}
                  value={formData.rentAmount ?? ""}
                  onChange={(e) => {
                    const value = e.target.value.replace(/^0+(?=\d)/, "");
                    onChange("rentAmount", parseFloat(value) || 0);
                  }}
                  placeholder="25000"
                  disabled={isLocked}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="propertyLocation">Address</Label>
              <Input
                id="propertyLocation"
                value={formData.propertyLocation ?? ""}
                onChange={(e) => onChange("propertyLocation", e.target.value)}
                disabled={isLocked}
                className={isLocked ? "opacity-70" : ""}
                placeholder="Enter property address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxTenants">
                Property Capacity (max tenants)
              </Label>
              <Input
                id="maxTenants"
                type="number"
                min={1}
                max={100}
                value={formData.maxTenants ?? ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/^0+(?=\d)/, "");
                  const next = parseInt(raw) || 1;
                  onChange("maxTenants", next);
                }}
                disabled={isLocked}
                className={isLocked ? "opacity-70" : ""}
              />
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const assigned = formData.pax;
                  const cap = formData.maxTenants || 1;
                  if (assigned > cap) {
                    return `${assigned} currently assigned — over capacity (${assigned}/${cap}). Adjust capacity or remove tenants.`;
                  }
                  return `${assigned} of ${cap} slot${cap === 1 ? "" : "s"} currently assigned. Capacity is record-keeping only; you can add tenants past it.`;
                })()}
              </p>
            </div>

            <div className="space-y-2 bg-muted/20 p-3 rounded-md">
              <p className="text-xs text-muted-foreground">
                Property ID: {formData.id}
              </p>
              <p className="text-xs text-muted-foreground">
                Status auto-derived from active tenants: currently{" "}
                <span className="font-medium capitalize">
                  {formData.pax > 0 ? "occupied" : "vacant"}
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
