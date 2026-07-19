"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Check,
  CreditCard,
  EditIcon,
  Pencil,
  Plus,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { OtherChargesPopup } from "@/components/other-charges-popup";
import { formatShortDate } from "@/components/add-property/format";
import { SectionHeader } from "@/components/add-property/section-header";
import { StepBanner } from "@/components/add-property/step-banner";
import type {
  BillingPeriodDraft,
  PropertyFormData,
} from "@/components/add-property/form-types";

interface StepBillingScheduleProps {
  formData: PropertyFormData;
  updateFormData: (field: keyof PropertyFormData, value: unknown) => void;
  setBillingSchedule: (
    update: (schedule: BillingPeriodDraft[]) => BillingPeriodDraft[],
  ) => void;
}

function calculateStatus(dueDate: string): string {
  if (!dueDate) return "Not Yet Due";

  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return due < today ? "Overdue" : "Not Yet Due";
}

function statusClasses(status: string): string {
  switch (status.toLowerCase()) {
    case "paid":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "partial":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "overdue":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

/**
 * Reviews the generated schedule, or builds one by hand when the billing type
 * is "blank". Owns the per-row editing state, which exists only while a cell is
 * open for edit and never needs to outlive this step.
 */
export function StepBillingSchedule({
  formData,
  updateFormData,
  setBillingSchedule,
}: StepBillingScheduleProps) {
  const [isOtherChargesPopupOpen, setIsOtherChargesPopupOpen] = useState(false);
  const [selectedBillingIndex, setSelectedBillingIndex] = useState<
    number | null
  >(null);
  const [editingRentIndex, setEditingRentIndex] = useState<number | null>(null);
  const [editingRentValue, setEditingRentValue] = useState<number>(0);
  const [editingDateIndex, setEditingDateIndex] = useState<number | null>(null);
  const [editingDateValue, setEditingDateValue] = useState<string>("");

  const isBlank = formData.billingType === "blank";

  const handleOtherChargesClick = (index: number) => {
    setSelectedBillingIndex(index);
    setIsOtherChargesPopupOpen(true);
  };

  const handleSaveOtherCharges = (
    totalAmount: number,
    items: Array<{ id: string; name: string; amount: number }>,
  ) => {
    if (selectedBillingIndex === null) return;

    setBillingSchedule((schedule) =>
      schedule.map((period, i) =>
        i === selectedBillingIndex
          ? {
              ...period,
              otherCharges: totalAmount,
              grossDue: period.rentDue + totalAmount,
              expenseItems: items,
            }
          : period,
      ),
    );

    setIsOtherChargesPopupOpen(false);
    setSelectedBillingIndex(null);

    toast.success("Other charges updated", {
      description: "The billing entry has been updated with the new charges.",
    });
  };

  const handleStartEditRent = (index: number, currentRent: number) => {
    setEditingRentIndex(index);
    setEditingRentValue(currentRent);
  };

  const handleSaveRent = (index: number) => {
    if (editingRentValue < 0) return;

    setBillingSchedule((schedule) =>
      schedule.map((period, i) =>
        i === index
          ? {
              ...period,
              rentDue: editingRentValue,
              grossDue: editingRentValue + period.otherCharges,
            }
          : period,
      ),
    );

    setEditingRentIndex(null);
    setEditingRentValue(0);

    toast.success("Rent amount updated");
  };

  const handleCancelEditRent = () => {
    setEditingRentIndex(null);
    setEditingRentValue(0);
  };

  const handleStartEditDate = (index: number, currentDate: string) => {
    setEditingDateIndex(index);
    setEditingDateValue(currentDate);
  };

  const handleSaveDate = (index: number) => {
    if (!editingDateValue) return;

    setBillingSchedule((schedule) =>
      schedule.map((period, i) =>
        i === index
          ? {
              ...period,
              dueDate: editingDateValue,
              status: calculateStatus(editingDateValue),
            }
          : period,
      ),
    );

    setEditingDateIndex(null);
    setEditingDateValue("");

    toast.success("Due date updated");
  };

  const handleCancelEditDate = () => {
    setEditingDateIndex(null);
    setEditingDateValue("");
  };

  const removeEntry = (index: number) => {
    setBillingSchedule((schedule) => schedule.filter((_, i) => i !== index));
  };

  const updatePeriod = (
    index: number,
    changes: Partial<BillingPeriodDraft>,
  ) => {
    setBillingSchedule((schedule) =>
      schedule.map((period, i) =>
        i === index ? { ...period, ...changes } : period,
      ),
    );
  };

  const isEmpty = formData.billingSchedule.length === 0 && isBlank;

  return (
    <div className="space-y-4">
      <StepBanner>
        {isBlank ? "Create" : "Review"} billing schedule for{" "}
        <span className="font-semibold text-foreground">
          {formData.unitName}
        </span>
      </StepBanner>

      <Card className="shadow-sm border">
        <CardContent className="p-3 md:p-5">
          <SectionHeader
            icon={Wallet}
            title="Accounting & Deposits"
            description="Up-front amounts collected at move-in"
          />

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
                    e.target.value === "" ? 0 : parseInt(e.target.value) || 0,
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
                    e.target.value === "" ? 0 : parseInt(e.target.value) || 0,
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
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Lease/Contract Date Expiry (Optional)
              </Label>
              <Input
                id="leaseDate"
                type="date"
                value={formData.leaseDate}
                onChange={(e) => updateFormData("leaseDate", e.target.value)}
                placeholder="Select lease/contract date"
                className="h-9 text-sm max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                Date when the lease/contract expires (optional)
              </p>
            </div>

            {(formData.advancePayment > 0 || formData.securityDeposit > 0) && (
              <div className="md:col-span-2 mt-2">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <h4 className="mb-2 text-xs font-semibold text-foreground">
                    Collected at move-in
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
                    <div className="col-span-2 border-t pt-2">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="ml-2 font-semibold text-green-600 dark:text-green-500">
                        ₱
                        {(
                          formData.advancePayment + formData.securityDeposit
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
          <SectionHeader
            icon={CreditCard}
            title={isBlank ? "Custom Billing Schedule" : "Billing Schedule"}
            description={
              isBlank
                ? "Add and customize billing entries as needed"
                : "Generated from the terms on the previous step"
            }
            action={
              isBlank ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setBillingSchedule((schedule) => [
                      ...schedule,
                      {
                        dueDate: "",
                        rentDue: 0,
                        otherCharges: 0,
                        grossDue: 0,
                        status: "Not Yet Due",
                        expenseItems: [],
                      },
                    ])
                  }
                  className="shrink-0 text-xs"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Entry
                </Button>
              ) : undefined
            }
          />
        </CardContent>

        <div className="block sm:hidden">
          {isEmpty ? (
            <div className="p-8 text-center text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <Calendar className="h-8 w-8 opacity-50" />
                <p className="text-sm">No billing entries yet</p>
                <p className="text-xs">
                  Tap &quot;Add Entry&quot; to create custom billing periods
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {formData.billingSchedule.map((bill, index) => (
                <div key={index} className="p-3">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-medium">{index + 1}</h4>
                    {isBlank ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          type="date"
                          value={bill.dueDate}
                          onChange={(e) =>
                            updatePeriod(index, {
                              dueDate: e.target.value,
                              status: calculateStatus(e.target.value),
                            })
                          }
                          className="h-6 text-xs w-28"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEntry(index)}
                          disabled={
                            index !== formData.billingSchedule.length - 1
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
                      <div className="text-muted-foreground">Rent</div>
                      {isBlank ? (
                        <Input
                          type="number"
                          min="0"
                          value={bill.rentDue}
                          onChange={(e) => {
                            const rentDue = parseInt(e.target.value) || 0;
                            updatePeriod(index, {
                              rentDue,
                              grossDue: rentDue + bill.otherCharges,
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
                      <div className="text-muted-foreground">Other Charges</div>
                      <button
                        onClick={() => handleOtherChargesClick(index)}
                        className="flex items-center gap-1 text-blue-600 font-medium"
                      >
                        ₱{bill.otherCharges.toLocaleString()}
                        <EditIcon className="h-3 w-3" />
                      </button>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Total</div>
                      <div className="font-bold">
                        ₱{bill.grossDue.toLocaleString()}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-muted-foreground">Status</div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusClasses(
                          bill.status,
                        )}`}
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
                  {isBlank && (
                    <th className="px-3 py-3 text-xs font-semibold text-muted-foreground text-center w-20">
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isEmpty ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-8 text-center text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Calendar className="h-8 w-8 opacity-50" />
                        <p className="text-sm">No billing entries yet</p>
                        <p className="text-xs">
                          Click &quot;Add Entry&quot; to create custom billing
                          periods
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
                        {isBlank ? (
                          editingDateIndex === index ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="date"
                                value={editingDateValue}
                                onChange={(e) =>
                                  setEditingDateValue(e.target.value)
                                }
                                className="h-8 w-38 text-sm"
                                autoFocus
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleSaveDate(index)}
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
                                  handleStartEditDate(index, bill.dueDate)
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
                        {isBlank ? (
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
                                onClick={() => handleSaveRent(index)}
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
                              <span>₱{bill.rentDue.toLocaleString()}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() =>
                                  handleStartEditRent(index, bill.rentDue)
                                }
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          )
                        ) : (
                          <span>₱{bill.rentDue.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOtherChargesClick(index)}
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
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusClasses(
                            bill.status,
                          )}`}
                        >
                          {bill.status}
                        </span>
                      </td>
                      {isBlank && (
                        <td className="px-3 py-3 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeEntry(index)}
                            disabled={
                              index !== formData.billingSchedule.length - 1
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

        <div className="bg-muted/20 p-3 border-t flex items-center justify-between">
          <div className="text-xs flex gap-3">
            <div>
              <span className="text-muted-foreground">Periods:</span>{" "}
              <span className="font-medium">
                {formData.billingSchedule.length}
              </span>
            </div>
            {!isBlank && (
              <div>
                <span className="text-muted-foreground">Monthly:</span>{" "}
                <span className="font-medium text-green-600">
                  ₱{formData.rentAmount.toLocaleString()}
                </span>
              </div>
            )}
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Total Contract Value:</span>{" "}
            <span className="font-bold">
              ₱
              {formData.billingSchedule
                .reduce((sum, bill) => sum + bill.grossDue, 0)
                .toLocaleString()}
            </span>
          </div>
        </div>
      </Card>

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
    </div>
  );
}
