"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/button";
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
import { Switch } from "@/components/ui/switch";
import {
  Calendar,
  Loader2,
  Save,
  Lock,
  Unlock,
  DollarSign,
  Trash2,
  Plus,
  Minus,
  ArrowRightLeft,
} from "lucide-react";
import { OtherChargesPopup } from "@/components/other-charges-popup";

// Define types
interface BillingEntry {
  id: string;
  property_id: string;
  tenant_id: string;
  due_date: string;
  rent_due: number;
  other_charges: number;
  gross_due: number;
  status: string;
  billing_period: number;
  paid_amount?: number;
  expense_items?: string;
  created_at: string;
  updated_at: string;
}

interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
}

interface BillingFormData {
  billingSchedule: Array<{
    id: string;
    dueDate: string;
    rentDue: number;
    otherCharges: number;
    grossDue: number;
    status: string;
    paidAmount?: number;
  }>;
  rentAmount: number;
  dueDay: string;
  rentStartDate: string;
}

interface EditBillingPopupProps {
  propertyId: string;
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSwitchToProperty?: () => void;
}

export function EditBillingPopup({
  propertyId,
  tenantId,
  isOpen,
  onClose,
  onSuccess,
  onSwitchToProperty,
}: EditBillingPopupProps) {
  const [loading, setLoading] = useState(true);
  const [isSwitchConfirmOpen, setIsSwitchConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<BillingFormData | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [isOtherChargesPopupOpen, setIsOtherChargesPopupOpen] = useState(false);
  const [selectedBillingIndex, setSelectedBillingIndex] = useState<
    number | null
  >(null);
  const [expenseItemsByBillingId, setExpenseItemsByBillingId] = useState<
    Record<string, ExpenseItem[]>
  >({});
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState<string>("rent");
  const [originalBillingIds, setOriginalBillingIds] = useState<string[]>([]);

  // Fetch billing data when popup opens
  useEffect(() => {
    const fetchBillingData = async () => {
      if (!isOpen || !propertyId || !tenantId) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch property for rent amount
        const { data: propertyData, error: propertyError } = await supabase
          .from("properties")
          .select("rent_amount")
          .eq("id", propertyId)
          .single();

        if (propertyError) throw propertyError;

        // Fetch tenant with billing entries
        const { data: tenantData, error: tenantError } = await supabase
          .from("tenants")
          .select("*, billing_entries(*)")
          .eq("id", tenantId)
          .single();

        if (tenantError) throw tenantError;

        const billingEntries = (tenantData.billing_entries ||
          []) as BillingEntry[];

        // Sort billing entries by due date in chronological order
        const sortedBillingEntries = billingEntries.sort((a, b) => {
          const dateA = new Date(a.due_date).getTime();
          const dateB = new Date(b.due_date).getTime();
          return dateA - dateB;
        });

        const initialFormData: BillingFormData = {
          rentAmount: propertyData.rent_amount,
          dueDay: tenantData.due_day || "30th/31st - Last Day",
          rentStartDate: tenantData.rent_start_date || "",
          billingSchedule: sortedBillingEntries.map((entry) => ({
            id: entry.id,
            dueDate: entry.due_date,
            rentDue: entry.rent_due,
            otherCharges: entry.other_charges,
            grossDue: entry.gross_due,
            status: entry.status,
            paidAmount: entry.paid_amount || 0,
          })),
        };

        // Initialize expense items
        const initialExpenseItems: Record<string, ExpenseItem[]> = {};
        sortedBillingEntries.forEach((entry) => {
          if (entry.expense_items) {
            try {
              const parsedItems = JSON.parse(entry.expense_items);
              if (Array.isArray(parsedItems)) {
                initialExpenseItems[entry.id] = parsedItems;
              }
            } catch (e) {
              console.error("Error parsing expense items:", e);
              initialExpenseItems[entry.id] = [];
            }
          } else {
            initialExpenseItems[entry.id] = [];
          }
        });

        setExpenseItemsByBillingId(initialExpenseItems);
        setFormData(initialFormData);
        // Store original billing IDs for tracking deletions
        setOriginalBillingIds(sortedBillingEntries.map((entry) => entry.id));
      } catch (err) {
        console.error("Error fetching billing data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load billing data",
        );
        toast.error("Failed to load billing data");
      } finally {
        setLoading(false);
      }
    };

    fetchBillingData();
  }, [isOpen, propertyId, tenantId]);

  // Recalculate all statuses based on paid amounts vs gross due
  // This ensures carry-over logic: excess payment from one entry flows to the next
  // Prioritizes earliest months first - redistributes all payments chronologically
  const recalculateAllStatuses = (
    schedule: BillingFormData["billingSchedule"],
  ) => {
    const updatedSchedule = [...schedule];

    // Sort by due date to process chronologically (earliest first)
    const sortedIndices = updatedSchedule
      .map((_, index) => index)
      .sort((a, b) => {
        const dateA = new Date(updatedSchedule[a].dueDate);
        const dateB = new Date(updatedSchedule[b].dueDate);
        return dateA.getTime() - dateB.getTime();
      });

    // Collect total payments across all entries
    let totalAvailablePayment = 0;
    for (const index of sortedIndices) {
      totalAvailablePayment += updatedSchedule[index].paidAmount || 0;
    }

    // Reset all paid amounts to 0 first
    for (const index of sortedIndices) {
      updatedSchedule[index] = {
        ...updatedSchedule[index],
        paidAmount: 0,
      };
    }

    // Redistribute payments chronologically, prioritizing earliest entries
    let remainingPayment = totalAvailablePayment;

    for (const index of sortedIndices) {
      if (remainingPayment <= 0) break;

      const billing = updatedSchedule[index];
      const amountDue = billing.grossDue;

      if (amountDue > 0) {
        const paymentToApply = Math.min(remainingPayment, amountDue);
        updatedSchedule[index] = {
          ...billing,
          paidAmount: paymentToApply,
        };
        remainingPayment -= paymentToApply;
      }
    }

    // Now determine statuses based on the redistributed payments
    for (const index of sortedIndices) {
      const billing = updatedSchedule[index];
      const currentPaid = billing.paidAmount || 0;

      // Always recalculate status based on current paid vs gross due
      let status: string;

      // Use a small epsilon for floating point comparison
      const epsilon = 0.01;

      if (currentPaid >= billing.grossDue - epsilon) {
        status = "paid";
      } else if (currentPaid > epsilon) {
        status = "partial";
      } else {
        // No payment - check if overdue or not yet due based on current date
        const dueDate = new Date(billing.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);

        if (dueDate < today) {
          status = "overdue";
        } else {
          status = "Not Yet Due";
        }
      }

      updatedSchedule[index] = { ...billing, status };
    }

    return updatedSchedule;
  };

  // Apply universal payment
  const applyUniversalPayment = async () => {
    if (!formData || paymentAmount === 0) return;

    // Handle Deposit and Advance Payment differently - update tenant fields immediately
    if (paymentType === "deposit" || paymentType === "advance") {
      try {
        // Fetch current tenant data
        const { data: tenantData, error: fetchError } = await supabase
          .from("tenants")
          .select("security_deposit, advance_payment")
          .eq("id", tenantId)
          .single();

        if (fetchError) throw fetchError;

        const fieldToUpdate =
          paymentType === "deposit" ? "security_deposit" : "advance_payment";
        const currentValue =
          paymentType === "deposit"
            ? tenantData.security_deposit || 0
            : tenantData.advance_payment || 0;
        const newValue = currentValue + paymentAmount;

        const { error: updateError } = await supabase
          .from("tenants")
          .update({
            [fieldToUpdate]: newValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", tenantId);

        if (updateError) throw updateError;

        toast.success(
          `${paymentType === "deposit" ? "Security Deposit" : "Advance Payment"} updated successfully`,
          {
            description: `New ${paymentType === "deposit" ? "deposit" : "advance"} amount: ₱${newValue.toLocaleString()}`,
          },
        );

        setPaymentAmount(0);
        return;
      } catch (err) {
        console.error("Error updating tenant field:", err);
        toast.error(
          `Failed to update ${paymentType === "deposit" ? "Security Deposit" : "Advance Payment"}`,
        );
        return;
      }
    }

    // Handle rent payment - preview mode, doesn't save until "Save Changes"
    let remainingPayment = paymentAmount;
    const updatedSchedule = [...formData.billingSchedule];

    // Sort by due date: chronologically for positive payments, reverse for negative
    const sortedIndices = updatedSchedule
      .map((_, index) => index)
      .sort((a, b) => {
        const dateA = new Date(updatedSchedule[a].dueDate);
        const dateB = new Date(updatedSchedule[b].dueDate);
        // For negative payments, sort in reverse (latest first)
        return paymentAmount < 0
          ? dateB.getTime() - dateA.getTime()
          : dateA.getTime() - dateB.getTime();
      });

    for (const index of sortedIndices) {
      // For negative payments, process all entries to allow deduction
      if (paymentAmount > 0 && remainingPayment <= 0) break;
      if (paymentAmount < 0 && remainingPayment >= 0) break;

      const billing = updatedSchedule[index];
      const currentPaid = billing.paidAmount || 0;

      // For positive payments, only apply to entries with amounts due
      // For negative payments, only deduct from entries with paid amounts
      if (paymentAmount > 0) {
        const amountDue = billing.grossDue - currentPaid;
        if (amountDue > 0) {
          const paymentToApply = Math.min(remainingPayment, amountDue);
          const newPaidAmount = currentPaid + paymentToApply;

          updatedSchedule[index] = {
            ...billing,
            paidAmount: newPaidAmount,
          };

          remainingPayment -= paymentToApply;
        }
      } else {
        // Negative payment - deduct from paid amounts
        if (currentPaid > 0) {
          // Add negative value (which subtracts)
          const deductionAmount = Math.max(remainingPayment, -currentPaid);
          const newPaidAmount = currentPaid + deductionAmount;

          updatedSchedule[index] = {
            ...billing,
            paidAmount: Math.max(0, newPaidAmount),
          };

          remainingPayment -= deductionAmount;
        }
      }
    }

    // Recalculate all statuses with carry-over logic
    const finalSchedule = recalculateAllStatuses(updatedSchedule);
    setFormData({ ...formData, billingSchedule: finalSchedule });
    setPaymentAmount(0);

    if (paymentAmount > 0 && remainingPayment > 0) {
      toast.info(`₱${remainingPayment.toFixed(2)} excess payment remaining`, {
        description: "Click 'Save Changes' to confirm this payment.",
      });
    } else if (paymentAmount < 0 && remainingPayment < 0) {
      toast.info(
        `₱${Math.abs(remainingPayment).toFixed(2)} could not be deducted`,
        {
          description: "No more paid amounts to deduct from.",
        },
      );
    } else {
      const action = paymentAmount > 0 ? "applied to" : "deducted from";
      toast.success(`Payment ${action} billing entries`, {
        description:
          "Don't forget to click 'Save Changes' to save this payment.",
      });
    }
  };

  // Handle saving other charges
  const handleSaveOtherCharges = (
    total: number,
    expenseItems: ExpenseItem[],
  ) => {
    if (selectedBillingIndex === null || !formData) return;

    const billing = formData.billingSchedule[selectedBillingIndex];
    const totalOtherCharges = total;
    const newGrossDue = billing.rentDue + totalOtherCharges;

    const updatedSchedule = [...formData.billingSchedule];
    updatedSchedule[selectedBillingIndex] = {
      ...billing,
      otherCharges: totalOtherCharges,
      grossDue: newGrossDue,
    };

    // Recalculate all statuses with carry-over logic after modifying gross due
    const finalSchedule = recalculateAllStatuses(updatedSchedule);

    setFormData({ ...formData, billingSchedule: finalSchedule });
    setExpenseItemsByBillingId({
      ...expenseItemsByBillingId,
      [billing.id]: expenseItems,
    });
  };

  // Helper function to calculate the proper due date based on dueDay setting
  const calculateDueDate = (baseDate: Date, dueDay: string): Date => {
    const month = baseDate.getMonth();
    const result = new Date(baseDate);

    // Handle new numeric format (1-31) and special values
    if (dueDay === "last" || dueDay === "30th/31st - Last Day") {
      // Set to last day of month
      result.setMonth(month + 1, 0);
    } else if (dueDay === "1" || dueDay === "1st - First Day") {
      result.setDate(1);
    } else if (dueDay === "15" || dueDay === "15th - Mid Month") {
      result.setDate(15);
    } else {
      // Handle custom numeric day (1-31)
      const dayNumber = parseInt(dueDay);
      if (!isNaN(dayNumber) && dayNumber >= 1 && dayNumber <= 31) {
        const lastDayOfMonth = new Date(
          result.getFullYear(),
          month + 1,
          0,
        ).getDate();
        // Set to the specified day, or last day if the month doesn't have that many days
        result.setDate(Math.min(dayNumber, lastDayOfMonth));
      } else {
        // Default to last day if format is unrecognized
        result.setMonth(month + 1, 0);
      }
    }

    return result;
  };

  const formatDueDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Add new billing month
  const addNewBillingMonth = () => {
    if (!formData || isLocked) return;

    const lastEntry =
      formData.billingSchedule[formData.billingSchedule.length - 1];

    let newDueDate: Date;

    if (!lastEntry) {
      // No existing entries - create the first billing entry based on rent start date
      if (!formData.rentStartDate) {
        toast.error("Please set a rent start date first");
        return;
      }

      // Use the rent start date as the base for the first billing entry
      const startDate = new Date(formData.rentStartDate);
      newDueDate = calculateDueDate(startDate, formData.dueDay);
    } else {
      // There are existing entries - add the next month
      const lastDueDate = new Date(lastEntry.dueDate);
      const newMonth = new Date(lastDueDate);
      newMonth.setMonth(lastDueDate.getMonth() + 1);

      // Apply the due day setting
      newDueDate = calculateDueDate(newMonth, formData.dueDay);
    }

    // Format the new due date
    const formattedDueDate = formatDueDate(newDueDate);

    // Create a new billing entry - use current property rent amount
    const newEntry = {
      id: `temp-${Date.now()}`, // Temporary ID until saved to database
      dueDate: formattedDueDate,
      rentDue: formData.rentAmount, // Use current property rent amount
      otherCharges: 0,
      grossDue: formData.rentAmount, // Calculate based on current rent
      status: "Not Yet Due",
      paidAmount: 0,
    };

    // Update form data with the new entry
    setFormData({
      ...formData,
      billingSchedule: [...formData.billingSchedule, newEntry],
    });

    toast.success("New billing month added", {
      description: "Don't forget to save your changes",
    });
  };

  // Delete billing row
  const deleteBillingRow = (index: number) => {
    if (!formData || isLocked) return;

    // Confirm deletion
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this billing entry?",
    );
    if (!confirmDelete) return;

    // Remove the entry from the form data
    const updatedSchedule = formData.billingSchedule.filter(
      (entry, i) => i !== index,
    );
    setFormData({ ...formData, billingSchedule: updatedSchedule });

    toast.success("Billing entry deleted", {
      description: "The billing entry has been removed.",
    });
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!formData) return;

    setSubmitting(true);

    try {
      // Update billing entries
      for (const billing of formData.billingSchedule) {
        const expenseItems = expenseItemsByBillingId[billing.id] || [];

        // For existing entries, update them
        if (!billing.id.startsWith("temp-")) {
          const { error } = await supabase
            .from("billing_entries")
            .update({
              rent_due: billing.rentDue,
              other_charges: billing.otherCharges,
              gross_due: billing.grossDue,
              status: billing.status,
              paid_amount: billing.paidAmount || 0,
              expense_items:
                expenseItems.length > 0 ? JSON.stringify(expenseItems) : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", billing.id);

          if (error) throw error;
        }
        // For new entries (temp IDs), insert them
        else {
          const billingPeriod = formData.billingSchedule.indexOf(billing) + 1;

          const { error } = await supabase.from("billing_entries").insert({
            property_id: propertyId,
            tenant_id: tenantId,
            due_date: billing.dueDate,
            rent_due: billing.rentDue,
            other_charges: billing.otherCharges,
            gross_due: billing.grossDue,
            status: billing.status,
            paid_amount: billing.paidAmount || 0,
            billing_period: billingPeriod,
            expense_items:
              expenseItems.length > 0 ? JSON.stringify(expenseItems) : null,
          });

          if (error) throw error;
        }
      }

      // Track deleted entries that need to be removed from database
      const currentEntryIds = formData.billingSchedule.map((entry) => entry.id);
      const deletedEntryIds = originalBillingIds.filter(
        (id) => !currentEntryIds.includes(id),
      );

      // Handle deleted entries if any
      if (deletedEntryIds.length > 0) {
        for (const deletedId of deletedEntryIds) {
          const { error: deleteError } = await supabase
            .from("billing_entries")
            .delete()
            .eq("id", deletedId);

          if (deleteError) throw deleteError;
        }
      }

      toast.success("Billing updated successfully");
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Error updating billing:", err);
      toast.error("Failed to update billing");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[95%] md:max-w-[85%] lg:max-w-[900px] w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6 [&>button]:hidden">
          <DialogHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
            <DialogTitle>Edit Billing</DialogTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Switch to Edit Property Button */}
              {onSwitchToProperty && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSwitchConfirmOpen(true)}
                  className="text-xs h-8 gap-1.5"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Edit Property</span>
                </Button>
              )}

              {/* Cancel Button */}
              <Button
                variant="outline"
                onClick={onClose}
                className="text-xs h-8"
                size="sm"
              >
                Cancel
              </Button>

              {/* Save Changes Button */}
              <Button
                onClick={handleSubmit}
                disabled={submitting || isLocked}
                className="gap-1.5 text-xs h-8"
                size="sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save
                  </>
                )}
              </Button>

              {/* Lock toggle */}
              <Label
                htmlFor="edit-mode"
                className="text-sm font-normal cursor-pointer"
              >
                {isLocked ? (
                  <span className="flex items-center gap-1.5">
                    <Lock className="h-4 w-4" />
                    Locked
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Unlock className="h-4 w-4" />
                    Editing
                  </span>
                )}
              </Label>
              <Switch
                id="edit-mode"
                checked={!isLocked}
                onCheckedChange={(checked) => setIsLocked(!checked)}
              />
            </div>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">{error}</div>
          ) : formData ? (
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  {/* Universal Payment Field */}
                  {formData.billingSchedule.length > 0 && (
                    <div className="mb-6 p-5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                      <Label className="text-sm font-medium flex items-center gap-1.5 mb-3">
                        <DollarSign className="h-4 w-4 text-blue-600" />
                        Apply Payment
                      </Label>
                      <div className="flex items-end gap-3">
                        <div className="flex-1 flex gap-2">
                          <Input
                            id="paymentAmount"
                            type="number"
                            value={paymentAmount || ""}
                            onChange={(e) => {
                              const value = e.target.value.replace(
                                /^0+(?=\d)/,
                                "",
                              );
                              setPaymentAmount(parseInt(value) || 0);
                            }}
                            placeholder="Enter amount"
                            className="h-10 text-sm flex-1"
                            disabled={isLocked}
                          />
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant={
                                paymentAmount >= 0 ? "default" : "outline"
                              }
                              size="icon"
                              className="h-10 w-10"
                              onClick={() =>
                                setPaymentAmount(Math.abs(paymentAmount))
                              }
                              disabled={isLocked || paymentAmount >= 0}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant={
                                paymentAmount < 0 ? "default" : "outline"
                              }
                              size="icon"
                              className="h-10 w-10"
                              onClick={() =>
                                setPaymentAmount(-Math.abs(paymentAmount))
                              }
                              disabled={isLocked || paymentAmount <= 0}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="w-44">
                          <Select
                            value={paymentType}
                            onValueChange={setPaymentType}
                            disabled={isLocked}
                          >
                            <SelectTrigger className="h-10 text-sm">
                              <SelectValue placeholder="Payment type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rent">Rent</SelectItem>
                              <SelectItem value="deposit">
                                Security Deposit
                              </SelectItem>
                              <SelectItem value="advance">
                                Advance Payment
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={applyUniversalPayment}
                          className="h-10 px-4 whitespace-nowrap"
                          disabled={isLocked || paymentAmount === 0}
                        >
                          <DollarSign className="h-4 w-4 mr-2" />
                          Apply Payment
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {paymentType === "deposit" || paymentType === "advance"
                          ? `This will ${paymentAmount >= 0 ? "add to" : "deduct from"} the tenant's ${paymentType === "deposit" ? "Security Deposit" : "Advance Payment"} balance.`
                          : `This will ${paymentAmount >= 0 ? "add" : "deduct"} ₱${Math.abs(paymentAmount).toLocaleString()} ${paymentAmount >= 0 ? "to" : "from"} billing entries, applied chronologically. Don't forget to click 'Save Changes' to save this payment.`}
                      </p>
                    </div>
                  )}

                  {/* Billing Table */}
                  <div className="w-full border rounded-lg overflow-hidden">
                    <table className="w-full table-auto border-collapse">
                      <thead className="bg-muted/50">
                        <tr className="text-left border-b">
                          <th className="px-3 py-3 text-xs font-semibold text-muted-foreground w-12">
                            #
                          </th>
                          <th className="px-3 py-3 text-xs font-semibold text-muted-foreground w-28">
                            Due Date
                          </th>
                          <th className="px-3 py-3 text-xs font-semibold text-muted-foreground text-right w-24">
                            Rent
                          </th>
                          <th className="px-3 py-3 text-xs font-semibold text-muted-foreground text-center w-32">
                            Other
                          </th>
                          <th className="px-3 py-3 text-xs font-semibold text-muted-foreground text-right w-24">
                            Total
                          </th>
                          <th className="px-3 py-3 text-xs font-semibold text-muted-foreground w-32">
                            Paid
                          </th>
                          <th className="px-3 py-3 text-xs font-semibold text-muted-foreground w-28">
                            Status
                          </th>
                          <th className="px-3 py-3 text-xs font-semibold text-muted-foreground text-center w-20">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {formData.billingSchedule.map((billing, index) => (
                          <tr key={billing.id} className="hover:bg-muted/30">
                            <td className="px-3 py-3 text-sm font-medium">
                              {index + 1}
                            </td>
                            <td className="px-3 py-3 text-sm">
                              {new Date(billing.dueDate).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric" },
                              )}
                            </td>
                            <td className="px-3 py-3 text-sm text-right font-medium">
                              ₱{billing.rentDue.toLocaleString()}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedBillingIndex(index);
                                  setIsOtherChargesPopupOpen(true);
                                }}
                                disabled={isLocked}
                                className="text-xs h-8 px-3 mx-auto hover:bg-accent"
                              >
                                {billing.otherCharges > 0
                                  ? `₱${billing.otherCharges.toLocaleString()}`
                                  : "+"}
                              </Button>
                            </td>
                            <td className="px-3 py-3 text-sm font-semibold text-right">
                              ₱{billing.grossDue.toLocaleString()}
                            </td>
                            <td className="px-3 py-3 text-sm text-right">
                              ₱{(billing.paidAmount || 0).toLocaleString()}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                  billing.status.toLowerCase() === "paid"
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                    : billing.status.toLowerCase() === "partial"
                                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                      : billing.status.toLowerCase() ===
                                          "overdue"
                                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                        : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                                }`}
                              >
                                {billing.status}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteBillingRow(index)}
                                disabled={
                                  isLocked ||
                                  index !== formData.billingSchedule.length - 1
                                }
                                className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Add New Billing Month Button */}
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addNewBillingMonth}
                      disabled={isLocked}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add New Billing Month
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Other Charges Popup */}
      {selectedBillingIndex !== null && formData && (
        <OtherChargesPopup
          isOpen={isOtherChargesPopupOpen}
          onClose={() => {
            setIsOtherChargesPopupOpen(false);
            setSelectedBillingIndex(null);
          }}
          onSave={handleSaveOtherCharges}
          existingItems={
            expenseItemsByBillingId[
              formData.billingSchedule[selectedBillingIndex].id
            ] || []
          }
          month={selectedBillingIndex + 1}
          dueDate={formData.billingSchedule[selectedBillingIndex].dueDate}
        />
      )}

      {/* Switch Confirmation Dialog */}
      <AlertDialog
        open={isSwitchConfirmOpen}
        onOpenChange={setIsSwitchConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to Edit Property?</AlertDialogTitle>
            <AlertDialogDescription>
              Any unsaved changes will be lost. Are you sure you want to switch
              to Edit Property?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsSwitchConfirmOpen(false);
                onClose(); // Close current dialog without saving
                onSwitchToProperty?.(); // Open property dialog
              }}
            >
              Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
