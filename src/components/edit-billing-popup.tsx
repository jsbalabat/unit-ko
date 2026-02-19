"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  User,
  Pencil,
  Check,
  X,
  Undo,
  Redo,
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
  const [paymentNote, setPaymentNote] = useState<string>("");
  const [receiptDate, setReceiptDate] = useState<string>("");
  const [originalBillingIds, setOriginalBillingIds] = useState<string[]>([]);
  const [tenantPax, setTenantPax] = useState<number>(1);
  const [tenantOverflow, setTenantOverflow] = useState<number>(0);
  const [pendingOverflow, setPendingOverflow] = useState<number>(0);
  const [deletedEntriesPaidAmounts, setDeletedEntriesPaidAmounts] = useState<
    Record<string, number>
  >({});
  const [editingRentIndex, setEditingRentIndex] = useState<number | null>(null);
  const [editingRentValue, setEditingRentValue] = useState<number>(0);
  const [editingDateIndex, setEditingDateIndex] = useState<number | null>(null);
  const [editingDateValue, setEditingDateValue] = useState<string>("");

  // Undo/Redo state using two-stack approach
  type HistorySnapshot = {
    formData: BillingFormData;
    expenseItemsByBillingId: Record<string, ExpenseItem[]>;
    deletedEntriesPaidAmounts: Record<string, number>;
    pendingOverflow: number;
  };
  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);

  // Save current state to undo stack before making changes
  const saveToHistory = (overridePendingOverflow?: number) => {
    if (!formData) return;

    const snapshot: HistorySnapshot = {
      formData: JSON.parse(JSON.stringify(formData)),
      expenseItemsByBillingId: JSON.parse(
        JSON.stringify(expenseItemsByBillingId),
      ),
      deletedEntriesPaidAmounts: JSON.parse(
        JSON.stringify(deletedEntriesPaidAmounts),
      ),
      pendingOverflow:
        overridePendingOverflow !== undefined
          ? overridePendingOverflow
          : pendingOverflow,
    };

    // Push current state to undo stack
    setUndoStack((prev) => {
      const newStack = [...prev, snapshot];
      // Keep only last 50 states to prevent memory issues
      if (newStack.length > 50) {
        newStack.shift();
      }
      return newStack;
    });

    // Clear redo stack on new action
    setRedoStack([]);
  };

  // Undo function
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !formData) return;

    // Save current state to redo stack
    const currentSnapshot: HistorySnapshot = {
      formData: JSON.parse(JSON.stringify(formData)),
      expenseItemsByBillingId: JSON.parse(
        JSON.stringify(expenseItemsByBillingId),
      ),
      deletedEntriesPaidAmounts: JSON.parse(
        JSON.stringify(deletedEntriesPaidAmounts),
      ),
      pendingOverflow,
    };
    setRedoStack((prev) => [...prev, currentSnapshot]);

    // Restore last state from undo stack
    const previousSnapshot = undoStack[undoStack.length - 1];
    setFormData(JSON.parse(JSON.stringify(previousSnapshot.formData)));
    setExpenseItemsByBillingId(
      JSON.parse(JSON.stringify(previousSnapshot.expenseItemsByBillingId)),
    );
    setDeletedEntriesPaidAmounts(
      JSON.parse(JSON.stringify(previousSnapshot.deletedEntriesPaidAmounts)),
    );
    setPendingOverflow(previousSnapshot.pendingOverflow);

    // Remove from undo stack
    setUndoStack((prev) => prev.slice(0, -1));
  }, [
    undoStack,
    formData,
    expenseItemsByBillingId,
    deletedEntriesPaidAmounts,
    pendingOverflow,
  ]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !formData) return;

    // Save current state to undo stack
    const currentSnapshot: HistorySnapshot = {
      formData: JSON.parse(JSON.stringify(formData)),
      expenseItemsByBillingId: JSON.parse(
        JSON.stringify(expenseItemsByBillingId),
      ),
      deletedEntriesPaidAmounts: JSON.parse(
        JSON.stringify(deletedEntriesPaidAmounts),
      ),
      pendingOverflow,
    };
    setUndoStack((prev) => {
      const newStack = [...prev, currentSnapshot];
      // Keep only last 50 states
      if (newStack.length > 50) {
        newStack.shift();
      }
      return newStack;
    });

    // Restore state from redo stack
    const nextSnapshot = redoStack[redoStack.length - 1];
    setFormData(JSON.parse(JSON.stringify(nextSnapshot.formData)));
    setExpenseItemsByBillingId(
      JSON.parse(JSON.stringify(nextSnapshot.expenseItemsByBillingId)),
    );
    setDeletedEntriesPaidAmounts(
      JSON.parse(JSON.stringify(nextSnapshot.deletedEntriesPaidAmounts)),
    );
    setPendingOverflow(nextSnapshot.pendingOverflow);

    // Remove from redo stack
    setRedoStack((prev) => prev.slice(0, -1));
  }, [
    redoStack,
    formData,
    expenseItemsByBillingId,
    deletedEntriesPaidAmounts,
    pendingOverflow,
  ]);

  // Fetch billing data when popup opens
  useEffect(() => {
    const fetchBillingData = async () => {
      if (!isOpen || !propertyId || !tenantId) return;

      setLoading(true);
      setError(null);

      // Reset undo/redo stacks when opening
      setUndoStack([]);
      setRedoStack([]);
      setPendingOverflow(0);

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
          .order("billing_period", {
            foreignTable: "billing_entries",
            ascending: true,
          })
          .single();

        if (tenantError) throw tenantError;

        // Set tenant pax for per-person billing display
        // Count only filled-in pax_details entries
        const filledPaxCount =
          tenantData.pax_details?.filter(
            (p: { name: string }) => p.name && p.name.trim() !== "",
          ).length || 0;
        setTenantPax(filledPaxCount > 0 ? filledPaxCount : tenantData.pax || 1);
        setTenantOverflow(tenantData.overflow || 0);

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
        // Reset deleted entries tracking
        setDeletedEntriesPaidAmounts({});

        // Undo/Redo stacks are already reset above (no initial state needed)
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

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    if (!isOpen || isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Y or Ctrl+Shift+Z or Cmd+Shift+Z for redo
      else if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLocked, handleUndo, handleRedo]);

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
        status = "Paid";
      } else if (currentPaid > epsilon) {
        status = "Partial";
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

        // TODO: Log to activity log with paymentNote and receiptDate when activity log is implemented
        // console.log('Payment note for activity log:', paymentNote);
        // console.log('Receipt date for activity log:', receiptDate);

        setPaymentAmount(0);
        setPaymentNote("");
        setReceiptDate("");
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
    let newPendingOverflow = pendingOverflow;

    // For negative payments, deduct from overflow FIRST
    if (paymentAmount < 0) {
      const totalAvailableOverflow = tenantOverflow + pendingOverflow;

      if (totalAvailableOverflow > 0) {
        // Deduct from overflow first
        const deductionFromOverflow = Math.min(
          Math.abs(remainingPayment),
          totalAvailableOverflow,
        );

        // Update pending overflow (negative value to deduct)
        newPendingOverflow = pendingOverflow - deductionFromOverflow;
        remainingPayment += deductionFromOverflow; // Make it less negative

        if (Math.abs(remainingPayment) < 0.01) {
          remainingPayment = 0; // Treat very small values as zero
        }
      }
    }

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
        // Negative payment - deduct from billing entries (after overflow is consumed)
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

    // Calculate final pending overflow
    if (paymentAmount > 0 && remainingPayment > 0) {
      newPendingOverflow = newPendingOverflow + remainingPayment;
    } else if (paymentAmount < 0 && remainingPayment < 0) {
      newPendingOverflow = newPendingOverflow + remainingPayment;
    }

    // Save to history with the new pending overflow value
    saveToHistory(newPendingOverflow);
    setFormData({ ...formData, billingSchedule: finalSchedule });
    setPendingOverflow(newPendingOverflow);

    // TODO: Log to activity log with paymentNote and receiptDate when activity log is implemented
    // console.log('Payment note for activity log:', paymentNote);
    // console.log('Receipt date for activity log:', receiptDate);

    setPaymentAmount(0);
    setPaymentNote("");
    setReceiptDate("");

    // Show appropriate toast for the payment
    if (paymentAmount > 0) {
      if (remainingPayment > 0) {
        toast.info(
          `₱${remainingPayment.toFixed(2)} excess payment added to overflow`,
          {
            description: "Will be applied when you save changes.",
          },
        );
      } else {
        toast.success("Payment applied to billing entries", {
          description:
            "Don't forget to click 'Save Changes' to save this payment.",
        });
      }
    } else if (paymentAmount < 0) {
      const totalDeduction = Math.abs(paymentAmount);
      const overflowDeduction = pendingOverflow - newPendingOverflow;
      const billingDeduction = totalDeduction - overflowDeduction;

      if (billingDeduction > 0 && overflowDeduction > 0) {
        toast.success(`₱${totalDeduction.toFixed(2)} deducted`, {
          description: `₱${overflowDeduction.toFixed(2)} from overflow, ₱${billingDeduction.toFixed(2)} from billing entries. Don't forget to save changes.`,
        });
      } else if (overflowDeduction > 0) {
        toast.success(
          `₱${overflowDeduction.toFixed(2)} deducted from overflow`,
          {
            description:
              "Don't forget to click 'Save Changes' to save this deduction.",
          },
        );
      } else if (billingDeduction > 0) {
        toast.success("Payment deducted from billing entries", {
          description:
            "Don't forget to click 'Save Changes' to save this payment.",
        });
      }

      if (remainingPayment < 0) {
        toast.warning(
          `₱${Math.abs(remainingPayment).toFixed(2)} could not be deducted`,
          {
            description: "No more overflow or paid amounts to deduct from.",
          },
        );
      }
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

    saveToHistory();
    setFormData({ ...formData, billingSchedule: finalSchedule });
    setExpenseItemsByBillingId({
      ...expenseItemsByBillingId,
      [billing.id]: expenseItems,
    });
  };

  // Handle editing rent amount
  const handleStartEditRent = (index: number, currentRent: number) => {
    setEditingRentIndex(index);
    setEditingRentValue(currentRent);
  };

  const handleSaveRent = (index: number) => {
    if (!formData || editingRentValue < 0) return;

    const billing = formData.billingSchedule[index];
    const newGrossDue = editingRentValue + billing.otherCharges;

    const updatedSchedule = [...formData.billingSchedule];
    updatedSchedule[index] = {
      ...billing,
      rentDue: editingRentValue,
      grossDue: newGrossDue,
    };

    // Recalculate all statuses with carry-over logic after modifying rent
    const finalSchedule = recalculateAllStatuses(updatedSchedule);

    saveToHistory();
    setFormData({ ...formData, billingSchedule: finalSchedule });
    setEditingRentIndex(null);
    setEditingRentValue(0);

    toast.success("Rent amount updated", {
      description: "Don't forget to click 'Save Changes' to save this change.",
    });
  };

  const handleCancelEditRent = () => {
    setEditingRentIndex(null);
    setEditingRentValue(0);
  };

  // Handle editing due date
  const handleStartEditDate = (index: number, currentDate: string) => {
    setEditingDateIndex(index);
    // Convert date to YYYY-MM-DD format for input
    const date = new Date(currentDate);
    const formattedDate = date.toISOString().split("T")[0];
    setEditingDateValue(formattedDate);
  };

  const handleSaveDate = (index: number) => {
    if (!formData || !editingDateValue) return;

    const schedule = formData.billingSchedule;
    const newDate = new Date(editingDateValue);

    // Validate with upper and lower limits
    // First date: no lower limit, upper limit is second date
    // Middle dates: lower limit is previous date, upper limit is next date
    // Last date: lower limit is previous date, no upper limit

    if (index > 0) {
      // Has lower limit (previous date)
      const previousDate = new Date(schedule[index - 1].dueDate);
      if (newDate <= previousDate) {
        toast.error("Invalid date", {
          description: "Due date must be after the previous billing period.",
        });
        return;
      }
    }

    if (index < schedule.length - 1) {
      // Has upper limit (next date)
      const nextDate = new Date(schedule[index + 1].dueDate);
      if (newDate >= nextDate) {
        toast.error("Invalid date", {
          description: "Due date must be before the next billing period.",
        });
        return;
      }
    }

    // Update the date
    const updatedSchedule = [...schedule];
    updatedSchedule[index] = {
      ...schedule[index],
      dueDate: editingDateValue,
    };

    // Recalculate all statuses after modifying date
    const finalSchedule = recalculateAllStatuses(updatedSchedule);

    saveToHistory();
    setFormData({ ...formData, billingSchedule: finalSchedule });
    setEditingDateIndex(null);
    setEditingDateValue("");

    toast.success("Due date updated", {
      description: "Don't forget to click 'Save Changes' to save this change.",
    });
  };

  const handleCancelEditDate = () => {
    setEditingDateIndex(null);
    setEditingDateValue("");
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
    saveToHistory();
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

    const deletedEntry = formData.billingSchedule[index];
    const paidAmount = deletedEntry.paidAmount || 0;

    // Save to history before making changes
    saveToHistory();

    // Track paid amount for this deleted entry (only if it has an original ID, not temp)
    if (!deletedEntry.id.startsWith("temp-") && paidAmount > 0) {
      setDeletedEntriesPaidAmounts((prev) => ({
        ...prev,
        [deletedEntry.id]: paidAmount,
      }));
    }

    // Remove the entry from the form data
    const updatedSchedule = formData.billingSchedule.filter(
      (entry, i) => i !== index,
    );
    setFormData({ ...formData, billingSchedule: updatedSchedule });

    toast.success("Billing entry deleted", {
      description:
        paidAmount > 0
          ? `The billing entry has been removed. ₱${paidAmount.toLocaleString()} will be returned to overflow when saved.`
          : "The billing entry has been removed.",
    });
  };

  // Insert additional charges row between periods
  const insertAdditionalChargesRow = (afterIndex: number) => {
    if (!formData || isLocked) return;

    const currentEntry = formData.billingSchedule[afterIndex];
    const nextEntry = formData.billingSchedule[afterIndex + 1];

    // Calculate a default due date between the two periods
    let newDueDate: Date;

    if (nextEntry) {
      // Insert between two entries - set to midpoint
      const currentDate = new Date(currentEntry.dueDate);
      const nextDate = new Date(nextEntry.dueDate);
      const midpoint = new Date(
        (currentDate.getTime() + nextDate.getTime()) / 2,
      );
      newDueDate = midpoint;
    } else {
      // Inserting after the last entry - add 1 day
      const currentDate = new Date(currentEntry.dueDate);
      newDueDate = new Date(currentDate);
      newDueDate.setDate(currentDate.getDate() + 1);
    }

    // Format the new due date
    const formattedDueDate = formatDueDate(newDueDate);

    // Create a new additional charges entry (no rent)
    const newEntry = {
      id: `temp-additional-${Date.now()}`, // Temporary ID
      dueDate: formattedDueDate,
      rentDue: 0, // No rent for additional charges row
      otherCharges: 0,
      grossDue: 0,
      status: "Not Yet Due",
      paidAmount: 0,
    };

    // Insert the entry after the specified index
    const updatedSchedule = [
      ...formData.billingSchedule.slice(0, afterIndex + 1),
      newEntry,
      ...formData.billingSchedule.slice(afterIndex + 1),
    ];

    saveToHistory();
    setFormData({
      ...formData,
      billingSchedule: updatedSchedule,
    });

    toast.success("Additional charges row added", {
      description: "Add charges and set the due date. Don't forget to save.",
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
          // Calculate billing period number
          // For additional charges (rentDue = 0), use 0 as billing_period
          // For regular rent entries, count only rent entries up to this point
          let billingPeriod = 0;
          if (billing.rentDue > 0) {
            billingPeriod = formData.billingSchedule
              .slice(0, formData.billingSchedule.indexOf(billing) + 1)
              .filter((b) => b.rentDue > 0).length;
          }

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

        // Calculate total paid amount from deleted entries and update overflow
        const totalDeletedPaidAmount = Object.values(
          deletedEntriesPaidAmounts,
        ).reduce((sum, amount) => sum + amount, 0);

        if (totalDeletedPaidAmount > 0) {
          const newOverflow = tenantOverflow + totalDeletedPaidAmount;

          const { error: overflowError } = await supabase
            .from("tenants")
            .update({ overflow: newOverflow })
            .eq("id", tenantId);

          if (overflowError) {
            console.error("Error updating overflow:", overflowError);
            toast.error("Failed to update overflow", {
              description:
                "The paid amounts could not be returned to overflow.",
            });
          } else {
            // Update local overflow state for reallocation
            setTenantOverflow(newOverflow);
          }
        }
      }

      // Automatically reallocate overflow to unpaid billing entries
      let currentOverflow = tenantOverflow;

      // Add any overflow from deleted entries
      if (deletedEntryIds.length > 0) {
        const totalDeletedPaidAmount = Object.values(
          deletedEntriesPaidAmounts,
        ).reduce((sum, amount) => sum + amount, 0);
        currentOverflow += totalDeletedPaidAmount;
      }

      // Add any pending overflow from payments
      currentOverflow += pendingOverflow;

      if (currentOverflow > 0) {
        // Get all billing entries sorted by due date
        const unpaidEntries = formData.billingSchedule
          .filter((billing) => {
            const balance = billing.grossDue - (billing.paidAmount || 0);
            return balance > 0 && !billing.id.startsWith("temp-");
          })
          .sort(
            (a, b) =>
              new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
          );

        let remainingOverflow = currentOverflow;
        const overflowApplications: Array<{
          id: string;
          additionalPayment: number;
        }> = [];

        // Apply overflow to unpaid entries
        for (const entry of unpaidEntries) {
          if (remainingOverflow <= 0) break;

          const balance = entry.grossDue - (entry.paidAmount || 0);
          const paymentToApply = Math.min(remainingOverflow, balance);

          overflowApplications.push({
            id: entry.id,
            additionalPayment: paymentToApply,
          });

          remainingOverflow -= paymentToApply;
        }

        // Update billing entries with overflow payments
        for (const application of overflowApplications) {
          const entry = formData.billingSchedule.find(
            (b) => b.id === application.id,
          );
          if (!entry) continue;

          const newPaidAmount =
            (entry.paidAmount || 0) + application.additionalPayment;
          const newStatus =
            newPaidAmount >= entry.grossDue ? "Paid" : "Partial";

          const { error: updateError } = await supabase
            .from("billing_entries")
            .update({
              paid_amount: newPaidAmount,
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", entry.id);

          if (updateError) {
            console.error("Error applying overflow:", updateError);
          }
        }

        // Update overflow in database with remaining amount
        const { error: finalOverflowError } = await supabase
          .from("tenants")
          .update({ overflow: remainingOverflow })
          .eq("id", tenantId);

        if (finalOverflowError) {
          console.error("Error updating final overflow:", finalOverflowError);
        }

        if (overflowApplications.length > 0) {
          const totalApplied = currentOverflow - remainingOverflow;
          toast.success("Billing updated successfully", {
            description: `₱${totalApplied.toLocaleString()} from overflow automatically applied to unpaid entries.`,
          });
        } else {
          toast.success("Billing updated successfully");
        }
      } else if (pendingOverflow !== 0 || deletedEntryIds.length > 0) {
        // Update overflow even if currentOverflow <= 0 when there's pending overflow or deleted entries
        const { error: finalOverflowError } = await supabase
          .from("tenants")
          .update({ overflow: Math.max(0, currentOverflow) })
          .eq("id", tenantId);

        if (finalOverflowError) {
          console.error("Error updating overflow:", finalOverflowError);
        }

        toast.success("Billing updated successfully");
      } else {
        toast.success("Billing updated successfully");
      }

      // Reset pending overflow and deleted entries after successful save
      setPendingOverflow(0);
      setDeletedEntriesPaidAmounts({});

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
              {/* Undo Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={undoStack.length === 0 || isLocked}
                className="text-xs h-8 gap-1.5"
                title="Undo (Ctrl+Z)"
              >
                <Undo className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Undo</span>
              </Button>

              {/* Redo Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRedo}
                disabled={redoStack.length === 0 || isLocked}
                className="text-xs h-8 gap-1.5"
                title="Redo (Ctrl+Y)"
              >
                <Redo className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Redo</span>
              </Button>

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
                              className={`h-10 w-10 ${
                                paymentAmount >= 0
                                  ? "!bg-emerald-500 hover:!bg-emerald-800 dark:!bg-emerald-900 dark:hover:!bg-emerald-1000 !text-white font-bold shadow-lg border-0 !opacity-100"
                                  : ""
                              }`}
                              onClick={() =>
                                setPaymentAmount(Math.abs(paymentAmount))
                              }
                              disabled={isLocked || paymentAmount >= 0}
                            >
                              <Plus className="h-5 w-5" />
                            </Button>
                            <Button
                              type="button"
                              variant={
                                paymentAmount < 0 ? "default" : "outline"
                              }
                              size="icon"
                              className={`h-10 w-10 ${
                                paymentAmount < 0
                                  ? "!bg-red-500 hover:!bg-red-600 dark:!bg-red-700 dark:hover:!bg-red-800 !text-white font-bold shadow-lg border-0 !opacity-100"
                                  : ""
                              }`}
                              onClick={() =>
                                setPaymentAmount(-Math.abs(paymentAmount))
                              }
                              disabled={isLocked || paymentAmount <= 0}
                            >
                              <Minus className="h-5 w-5" />
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
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label
                            htmlFor="receiptDate"
                            className="text-xs font-medium"
                          >
                            Receipt Date (Optional)
                          </Label>
                          <Input
                            id="receiptDate"
                            type="date"
                            value={receiptDate}
                            onChange={(e) => setReceiptDate(e.target.value)}
                            className="mt-1.5 h-9 text-xs"
                            disabled={isLocked}
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">
                            If payment date differs from log date
                          </p>
                        </div>
                        <div>
                          <Label
                            htmlFor="paymentNote"
                            className="text-xs font-medium"
                          >
                            Note (Optional)
                          </Label>
                          <textarea
                            id="paymentNote"
                            value={paymentNote}
                            onChange={(e) => setPaymentNote(e.target.value)}
                            placeholder="Add a note for this payment..."
                            className="w-full mt-1.5 px-3 py-2 text-xs border rounded-md resize-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            rows={2}
                            disabled={isLocked}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {paymentType === "deposit" || paymentType === "advance"
                          ? `This will ${paymentAmount >= 0 ? "add to" : "deduct from"} the tenant's ${paymentType === "deposit" ? "Security Deposit" : "Advance Payment"} balance.`
                          : `This will ${paymentAmount >= 0 ? "add" : "deduct"} ₱${Math.abs(paymentAmount).toLocaleString()} ${paymentAmount >= 0 ? "to" : "from"} billing entries, applied chronologically. Don't forget to click 'Save Changes' to save this payment.`}
                      </p>
                    </div>
                  )}

                  {/* Overflow and Refund Information */}
                  {(tenantOverflow > 0 ||
                    pendingOverflow !== 0 ||
                    Object.keys(deletedEntriesPaidAmounts).length > 0) && (
                    <div className="mb-3 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-md flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-4">
                        <DollarSign className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        {tenantOverflow > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              Overflow:
                            </span>
                            <span className="font-semibold text-blue-700 dark:text-blue-300">
                              ₱{tenantOverflow.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {pendingOverflow !== 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              Pending Overflow:
                            </span>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                              {pendingOverflow > 0 ? "+" : ""}₱
                              {pendingOverflow.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {Object.keys(deletedEntriesPaidAmounts).length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              Pending Refund:
                            </span>
                            <span className="font-semibold text-amber-700 dark:text-amber-300">
                              ₱
                              {Object.values(deletedEntriesPaidAmounts)
                                .reduce((sum, amt) => sum + amt, 0)
                                .toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                      {(Object.keys(deletedEntriesPaidAmounts).length > 0 ||
                        pendingOverflow !== 0) && (
                        <span className="text-[10px] text-muted-foreground italic">
                          Apply on save
                        </span>
                      )}
                    </div>
                  )}

                  {/* Billing Table */}
                  <div className="w-full border rounded-lg overflow-hidden">
                    <table className="w-full table-auto border-collapse">
                      <thead className="bg-muted/50">
                        <tr className="text-left border-b">
                          <th className="px-3 py-3 text-xs font-semibold text-muted-foreground w-12">
                            Period
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
                        {formData.billingSchedule.map((billing, index) => {
                          // Calculate period number (only for rows with rent)
                          const periodNumber = formData.billingSchedule
                            .slice(0, index + 1)
                            .filter((b) => b.rentDue > 0).length;
                          const isAdditionalCharges = billing.rentDue === 0;

                          return (
                            <tr
                              key={billing.id}
                              className="hover:bg-muted/30 group/insert"
                            >
                              <td className="px-3 py-3 text-sm font-medium relative">
                                {/* Insert Additional Charges Button - Positioned on the line between rows */}
                                {!isLocked &&
                                  index <
                                    formData.billingSchedule.length - 1 && (
                                    <div
                                      className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 z-10"
                                      style={{ marginLeft: "600%" }}
                                    >
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          insertAdditionalChargesRow(index)
                                        }
                                        className="h-5 w-5 opacity-0 group-hover/insert:opacity-100 transition-opacity rounded-full bg-background border border-border hover:bg-muted shadow-sm"
                                        title="Insert additional charges between periods"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                {isAdditionalCharges ? (
                                  <span className="text-muted-foreground italic text-xs">
                                    —
                                  </span>
                                ) : (
                                  periodNumber
                                )}
                              </td>
                              <td className="px-3 py-3 text-sm">
                                {editingDateIndex === index ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="date"
                                      value={editingDateValue}
                                      onChange={(e) =>
                                        setEditingDateValue(e.target.value)
                                      }
                                      className="h-8 w-32 text-sm"
                                      autoFocus
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                      onClick={() => handleSaveDate(index)}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
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
                                      {new Date(
                                        billing.dueDate,
                                      ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() =>
                                        handleStartEditDate(
                                          index,
                                          billing.dueDate,
                                        )
                                      }
                                      disabled={isLocked}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 text-sm text-right font-medium">
                                {isAdditionalCharges ? (
                                  <span className="text-muted-foreground italic text-xs">
                                    —
                                  </span>
                                ) : editingRentIndex === index ? (
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
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                      onClick={() => handleSaveRent(index)}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
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
                                    <span>
                                      ₱{billing.rentDue.toLocaleString()}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() =>
                                        handleStartEditRent(
                                          index,
                                          billing.rentDue,
                                        )
                                      }
                                      disabled={isLocked}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
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
                                      : billing.status.toLowerCase() ===
                                          "partial"
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
                                    (!isAdditionalCharges &&
                                      index !==
                                        formData.billingSchedule.length - 1)
                                  }
                                  className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Add New Billing Period Button */}
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addNewBillingMonth}
                      disabled={isLocked}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add New Billing Period
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
