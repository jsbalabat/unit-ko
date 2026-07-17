"use client";

import {
  Building,
  Calendar,
  CreditCard,
  DollarSign,
  MapPin,
  User,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { PropertyFormData } from "./form-types";
import { isAddingTenants as deriveIsAddingTenants } from "./validation";
import { formatMonthYear, formatShortDate } from "./format";

interface PropertyPreviewProps {
  formData: PropertyFormData;
  currentStep: number;
}

// Whether the preview has anything real to show. Until the landlord types
// something the cards would render, they'd be all placeholders ("Unit Name",
// "₱0/month"); the panel says so plainly instead. The column itself stays put so
// the form doesn't reflow the moment the first character is typed.
function hasPreviewContent(formData: PropertyFormData): boolean {
  return Boolean(
    formData.unitName.trim() ||
      formData.propertyType ||
      formData.propertyLocation.trim() ||
      formData.rentAmount > 0 ||
      formData.rentPerCollection > 0 ||
      deriveIsAddingTenants(formData),
  );
}

export function PropertyPreview({
  formData,
  currentStep,
}: PropertyPreviewProps) {
  const filledTenantsCount =
    formData.tenants?.filter((t) => t.tenantName && t.tenantName.trim() !== "")
      .length || 0;

  // The preview shows Occupied when the landlord is entering tenants. The saved
  // property's real occupancy comes from the server (v_property_occupancy) once
  // the lease exists.
  const isAddingTenants = deriveIsAddingTenants(formData);

  const paxCount =
    formData.maxTenants > 1
      ? filledTenantsCount > 0
        ? filledTenantsCount
        : formData.maxTenants
      : formData.tenantName
        ? 1
        : 0;

  // Pre-organized carries rent per tenant already; otherwise split the total.
  const perPersonRent =
    formData.billingType === "pre-organized" && formData.rentPerCollection > 0
      ? formData.rentPerCollection
      : formData.rentAmount && paxCount > 1
        ? Math.floor(formData.rentAmount / paxCount)
        : formData.rentAmount;

  const totalRent =
    formData.billingType === "pre-organized" &&
    formData.rentPerCollection > 0 &&
    paxCount > 0
      ? formData.rentPerCollection * paxCount
      : formData.rentAmount;

  const namedTenants = formData.tenants.filter((t) => t.tenantName);

  return (
    <div className="space-y-4">
      {/* The panel renders muted/20 over the dialog's bg-background, so the
          sticky header needs that exact colour at full opacity — bg-muted/20
          here would stay 20% transparent and let the card scroll through it.
          color-mix keeps it correct in both themes, since both vars swap.
          -mx-4/px-4 spans the panel's padding so nothing bleeds up the sides. */}
      <div className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-2 border-b bg-[color-mix(in_oklab,var(--muted)_20%,var(--background))]">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Live Preview
        </h3>
        <p className="text-xs text-muted-foreground">
          See how your property will look
        </p>
      </div>

      {!hasPreviewContent(formData) ? (
        <div className="rounded-lg border border-dashed border-border py-10 px-4 text-center">
          <p className="text-sm text-muted-foreground">
            No information input yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your property will appear here as you fill in the form.
          </p>
        </div>
      ) : (
        <>
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
                    isAddingTenants
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                      : "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
                  )}
                >
                  {isAddingTenants ? "Occupied" : "Vacant"}
                </div>
              </div>

              {formData.propertyLocation && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">
                    {formData.propertyLocation}
                  </span>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {formData.billingType === "pre-organized" && paxCount > 1
                      ? "Total Property Rent"
                      : "Monthly Rent"}
                  </span>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-green-600">
                      ₱{totalRent.toLocaleString() || "0"}/month
                    </div>
                    {paxCount > 1 && perPersonRent > 0 && (
                      <div className="text-xs text-muted-foreground">
                        ₱{perPersonRent.toLocaleString()} per tenant
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {isAddingTenants && (
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
                          <span className="font-medium">Tenant</span>
                        </div>
                        {formData.tenantName && (
                          <p className="text-xs ml-5">{formData.tenantName}</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {namedTenants.length > 1 ? (
                          <div className="relative group">
                            <div className="flex items-center gap-2 text-xs">
                              <User className="h-3 w-3 text-blue-600" />
                              <span className="font-medium cursor-help">
                                Multiple ({namedTenants.length})
                              </span>
                            </div>
                            <div className="hidden group-hover:block absolute left-0 top-full mt-2 bg-popover shadow-lg rounded-md p-3 z-50 min-w-[200px] border">
                              <div className="text-xs font-medium mb-2">
                                Tenants:
                              </div>
                              <div className="space-y-1">
                                {namedTenants.map((tenant, idx) => (
                                  <div key={idx} className="text-xs">
                                    {idx + 1}. {tenant.tenantName}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          namedTenants.map((tenant, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-xs"
                            >
                              <User className="h-3 w-3 text-blue-600" />
                              <span className="font-medium">
                                {tenant.tenantName}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {currentStep >= 2 && isAddingTenants && (
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
                        {formatShortDate(formData.rentStartDate)}
                      </span>
                    </div>
                  )}

                  {formData.contractMonths > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-medium">
                        {formData.contractMonths}{" "}
                        {formData.contractMonths === 1 ? "period" : "periods"}
                        {formData.formBasis && ` (${formData.formBasis})`}
                      </span>
                    </div>
                  )}

                  {formData.billingType === "pre-organized" && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Billing Template
                        </span>
                        <span className="font-medium capitalize">
                          Pre-organized
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frequency</span>
                        <span className="font-medium capitalize">
                          {formData.formBasis}
                        </span>
                      </div>
                      {formData.rentPerCollection > 0 && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Per Tenant
                            </span>
                            <span className="font-medium text-green-600">
                              ₱{formData.rentPerCollection.toLocaleString()}
                            </span>
                          </div>
                          {formData.maxTenants > 1 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Total Property
                              </span>
                              <span className="font-medium text-green-700 dark:text-green-400">
                                ₱
                                {(
                                  formData.rentPerCollection *
                                  (filledTenantsCount || formData.maxTenants)
                                ).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {formData.billingType === "blank" && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Billing Template
                      </span>
                      <span className="font-medium">Blank (Custom)</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep >= 3 && isAddingTenants && (
            <Card className="shadow-sm">
              <CardContent className="p-4 space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-orange-600" />
                  Accounting
                </h4>

                <div className="space-y-2 text-xs">
                  {formData.advancePayment > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Advance Payment
                      </span>
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
                      <span>{formatMonthYear(bill.dueDate)}</span>
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
        </>
      )}
    </div>
  );
}
