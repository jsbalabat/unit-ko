"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  FileText,
  ClipboardCheck,
  Pencil,
} from "lucide-react";
import { billingStatusOf } from "../billing-status";
import {
  Property,
  Tenant,
  BillingEntry,
  BillingDisplayRow,
  formatCurrency,
  formatDueDate,
  getStatusColorClass,
} from "./types";

export interface PropertySoaTabProps {
  property: Property;
  activeTenant: Tenant | undefined;
  paxCount: number;
  billingViewMode: string;
  onUpdateBillingViewMode: (mode: string) => void;
  tenantProfiles: Array<{ name: string; email: string; phone: string }>;
  tenantIdsByIndex: string[];
  liveBillingEntries: BillingEntry[];
  billingDisplayRows: BillingDisplayRow[];
  totalRevenue: number;
  pendingPayments: number;
  unpaidBalance: number;
  selectedBillingTenant: { name: string; email: string; phone: string } | null;
  selectedBillingTenantIdx: number | null;
  onOpenPaymentDialog: () => void;
  onOpenEditBilling: () => void;
}

export function PropertySoaTab({
  property,
  activeTenant,
  paxCount,
  billingViewMode,
  onUpdateBillingViewMode,
  tenantProfiles,
  tenantIdsByIndex,
  liveBillingEntries,
  billingDisplayRows,
  totalRevenue,
  pendingPayments,
  unpaidBalance,
  selectedBillingTenant,
  selectedBillingTenantIdx,
  onOpenPaymentDialog,
  onOpenEditBilling,
}: PropertySoaTabProps) {
  if (property.occupancy_status !== "occupied" || !activeTenant) {
    return (
      <div className="flex flex-col items-center justify-center p-8 md:p-12 text-center">
        <div className="rounded-full bg-muted/50 p-4 mb-4"></div>
        <h3 className="text-base md:text-lg font-medium mt-2">
          No Financial Records
        </h3>
        <p className="text-muted-foreground mt-2 max-w-md text-xs md:text-sm">
          This property is currently vacant. Financial records will be available
          once a tenant is added to this property.
        </p>
      </div>
    );
  }

  const isIndividualView = billingViewMode.startsWith("tenant-");
  const selectedTenantIdx = isIndividualView
    ? parseInt(billingViewMode.split("-")[1], 10)
    : null;
  const isVacantSlot =
    isIndividualView &&
    selectedTenantIdx !== null &&
    (!tenantProfiles[selectedTenantIdx]?.name ||
      tenantProfiles[selectedTenantIdx]?.name.trim() === "");

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Financial Overview - Ticker Strip */}
      <div className="sticky top-0 z-20">
        <div className="overflow-hidden bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-lg border shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="px-4 pt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              View Mode
            </span>
            {paxCount > 1 ? (
              <Select
                value={billingViewMode}
                onValueChange={onUpdateBillingViewMode}
              >
                <SelectTrigger
                  id="billing-view-strip"
                  className="h-8 text-xs w-full sm:w-[240px] bg-background/90"
                >
                  <SelectValue placeholder="Select view mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consolidated">
                    Consolidated (All Tenants)
                  </SelectItem>
                  {tenantProfiles.map((person, idx) => (
                    <SelectItem key={idx} value={`tenant-${idx}`}>
                      {person.name || `Tenant ${idx + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                {selectedBillingTenant?.name ||
                  `Tenant ${(selectedBillingTenantIdx ?? 0) + 1}`}
              </span>
            )}
          </div>
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex items-center justify-between sm:justify-around py-3 px-4 gap-4 sm:gap-6 min-w-max sm:min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                    Total Revenue
                  </div>
                  <div className="text-lg font-bold text-green-600 dark:text-green-400 whitespace-nowrap">
                    {formatCurrency(totalRevenue)}
                  </div>
                </div>
              </div>

              <div className="h-10 w-px bg-border shrink-0" />

              <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                    Pending Payments
                  </div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    {formatCurrency(pendingPayments)}
                  </div>
                </div>
              </div>

              <div className="h-10 w-px bg-border shrink-0" />

              <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                    Unpaid Balance
                  </div>
                  <div className="text-lg font-bold text-red-600 dark:text-red-400 whitespace-nowrap">
                    {formatCurrency(unpaidBalance)}
                  </div>
                </div>
              </div>

              <div className="h-10 w-px bg-border shrink-0" />

              <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                    Advance Payment
                  </div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    {activeTenant.advance_payment !== undefined &&
                    activeTenant.advance_payment > 0
                      ? formatCurrency(activeTenant.advance_payment)
                      : formatCurrency(0)}
                  </div>
                </div>
              </div>

              <div className="h-10 w-px bg-border shrink-0" />

              <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                    Security Deposit
                  </div>
                  <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400 whitespace-nowrap">
                    {activeTenant.security_deposit !== undefined &&
                    activeTenant.security_deposit > 0
                      ? formatCurrency(activeTenant.security_deposit)
                      : formatCurrency(0)}
                  </div>
                </div>
              </div>

              <div className="h-10 w-px bg-border shrink-0" />

              <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                    Overflow (Excess)
                  </div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    {activeTenant.overflow !== undefined &&
                    activeTenant.overflow > 0
                      ? formatCurrency(activeTenant.overflow)
                      : formatCurrency(0)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-4 md:p-6">
          <div className="flex justify-between items-center mb-4 md:mb-6 flex-wrap gap-2">
            <h3 className="text-base md:text-lg font-semibold flex items-center">
              <FileText className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
              Billing Table
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={onOpenPaymentDialog}
                disabled={paxCount > 1 && billingViewMode === "consolidated"}
                className="text-xs h-8 gap-1.5"
                title={
                  paxCount > 1 && billingViewMode === "consolidated"
                    ? "Switch to individual tenant view to apply payment"
                    : ""
                }
              >
                Apply Payment
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenEditBilling}
                disabled={paxCount > 1 && billingViewMode === "consolidated"}
                className="text-xs h-8 gap-1.5"
                title={
                  paxCount > 1 && billingViewMode === "consolidated"
                    ? "Switch to individual tenant view to edit billing"
                    : ""
                }
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Billing
              </Button>
            </div>
          </div>

          {/* Info banner for multi-tenant payment tracking - only show in consolidated view */}
          {paxCount > 1 && billingViewMode === "consolidated" && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Consolidated View - All {paxCount} Tenant Accounts
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Each tenant has their own billing account. Total amounts shown
                    are the sum of all individual accounts. To edit billing or
                    view detailed breakdowns, select a specific tenant from the
                    dropdown above.
                  </p>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1.5 italic">
                    Each tenant can have their own custom rent and charges. Use
                    &quot;Edit Billing&quot; to modify individual amounts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Individual Tenant View Indicator */}
          {billingViewMode.startsWith("tenant-") && (
            <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <div className="h-5 w-5 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-purple-900 dark:text-purple-100 mb-1">
                    Individual Account View:{" "}
                    {tenantProfiles[parseInt(billingViewMode.split("-")[1], 10)]
                      ?.name ||
                      `Tenant ${parseInt(billingViewMode.split("-")[1], 10) + 1}`}
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    Viewing this tenant&apos;s individual billing account.
                    Amounts shown are specific to this tenant only. You can edit
                    this tenant&apos;s billing using the &quot;Edit Billing&quot;
                    button.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Responsive table with horizontal scrolling */}
          <div className="overflow-x-auto -mx-4 sm:-mx-6">
            <div className="inline-block min-w-full align-middle px-4 sm:px-6">
              <div className="overflow-hidden border rounded-md">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50">
                    <tr>
                      <th
                        scope="col"
                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                      >
                        Period
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                      >
                        Due Date
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                      >
                        Rent Due
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                      >
                        Other Charges
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                      >
                        Total Due
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                      >
                        Paid Amount
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted/40 bg-background">
                    {isVacantSlot ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-8 text-center"
                        >
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <FileText className="h-8 w-8 mb-2 opacity-40" />
                            <p className="text-sm font-medium">
                              No records found
                            </p>
                            <p className="text-xs mt-1">
                              This tenant slot is currently vacant
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : billingDisplayRows.length > 0 ? (
                      billingDisplayRows.map((row) => {
                        const effectivePaid =
                          row.paidAmount + row.appliedCredit;
                        const rowStatus = billingStatusOf(
                          row.grossDue,
                          effectivePaid,
                          row.balance,
                          row.dueDate,
                        );

                        return (
                          <tr
                            key={row.key}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className="px-3 py-2 text-xs whitespace-nowrap">
                              <div className="flex items-center">
                                <ClipboardCheck className="h-3 w-3 text-muted-foreground mr-1.5 flex-shrink-0" />
                                <span>
                                  {row.billingPeriod > 0 ? (
                                    row.billingPeriod
                                  ) : (
                                    <span className="text-muted-foreground italic">
                                      —
                                    </span>
                                  )}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-xs whitespace-nowrap">
                              {formatDueDate(row.dueDate)}
                            </td>
                            <td className="px-3 py-2 text-xs font-medium text-green-600 dark:text-green-400 whitespace-nowrap">
                              {formatCurrency(row.rentDue)}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              <div className="group inline-block relative">
                                <div className="flex items-center cursor-help gap-1">
                                  <span>
                                    {formatCurrency(row.otherCharges)}
                                  </span>
                                  <span className="text-[10px] bg-muted rounded-full px-1 flex items-center justify-center w-4 h-4">
                                    {row.expenseItems.length}
                                  </span>
                                </div>

                                {row.expenseItems.length > 0 && (
                                  <span className="absolute invisible group-hover:visible z-[100]">
                                    <span className="relative block top-full right-0 mt-1 bg-popover shadow-lg rounded-md p-2 min-w-[200px] border">
                                      <div className="text-xs font-medium mb-1.5">
                                        {row.billingPeriod > 0
                                          ? `Expenses for Period ${row.billingPeriod}`
                                          : "Additional Charges"}
                                        :
                                      </div>
                                      {row.expenseItems.map((item) => (
                                        <div
                                          key={item.id}
                                          className="flex justify-between text-xs mb-1.5"
                                        >
                                          <span className="truncate max-w-[150px] pr-4">
                                            {item.name}
                                          </span>
                                          <span className="text-right font-medium">
                                            {formatCurrency(item.amount)}
                                          </span>
                                        </div>
                                      ))}
                                      {row.expenseItems.length > 1 && (
                                        <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between text-xs font-medium">
                                          <span>Total Expenses</span>
                                          <span>
                                            {formatCurrency(row.otherCharges)}
                                          </span>
                                        </div>
                                      )}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold whitespace-nowrap">
                              {formatCurrency(row.grossDue)}
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                              {formatCurrency(effectivePaid)}
                            </td>
                            <td className="px-3 py-2 text-xs whitespace-nowrap">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0.5 ${getStatusColorClass(
                                  rowStatus,
                                )}`}
                              >
                                {rowStatus}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-8 text-center"
                        >
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <FileText className="h-8 w-8 mb-2 opacity-40" />
                            <p className="text-sm font-medium">
                              No billing entries yet
                            </p>
                            <p className="text-xs mt-1">
                              Click &quot;Edit Property&quot; to add billing
                              entries
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Per-Tenant Payment Summary */}
          {paxCount > 1 && liveBillingEntries.length > 0 && (
            <div className="mt-6 border-t pt-6">
              <h4 className="text-sm font-semibold mb-3 flex items-center">
                <User className="h-4 w-4 mr-2 text-primary" />
                Payment Summary by Tenant (Grand Total)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: paxCount }, (_, i) => {
                  const person = tenantProfiles[i];
                  const tenantId = tenantIdsByIndex[i];

                  let tenantTotalDue = 0;
                  let tenantTotalPaid = 0;

                  liveBillingEntries.forEach((entry) => {
                    if (tenantId && entry.tenant_id === tenantId) {
                      tenantTotalDue += entry.gross_due;
                      tenantTotalPaid += entry.paid_amount || 0;
                    }
                  });

                  const tenantBalance = tenantTotalDue - tenantTotalPaid;
                  const isNotYetSet = tenantTotalDue <= 0.01;
                  const isPaidUp = !isNotYetSet && tenantBalance <= 0.01;

                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${
                        isNotYetSet
                          ? "bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800"
                          : isPaidUp
                            ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                            : "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center ${
                            isNotYetSet
                              ? "bg-gray-100 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300"
                              : isPaidUp
                                ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                                : "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300"
                          }`}
                        >
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {person?.name || `Tenant ${i + 1}`}
                          </p>
                          <p
                            className={`text-[10px] font-medium ${
                              isNotYetSet
                                ? "text-gray-600 dark:text-gray-400"
                                : isPaidUp
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-orange-600 dark:text-orange-400"
                            }`}
                          >
                            {isNotYetSet
                              ? "Not Yet Set"
                              : isPaidUp
                                ? "✓ Paid Up"
                                : `₱${tenantBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} Due`}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Due:</span>
                          <span className="font-medium">
                            {formatCurrency(tenantTotalDue)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Paid:</span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            {formatCurrency(tenantTotalPaid)}
                          </span>
                        </div>
                        {!isPaidUp && (
                          <div className="flex justify-between pt-1 border-t">
                            <span className="font-medium">Balance:</span>
                            <span className="font-bold text-orange-600 dark:text-orange-400">
                              {formatCurrency(tenantBalance)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
