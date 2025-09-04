"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Trash2, Plus } from "lucide-react";

// Define a type for expense items
interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
}

interface OtherChargesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (totalAmount: number, items: ExpenseItem[]) => void;
  initialTotal: number;
  month: number;
  dueDate: string;
  disabled: boolean;
  existingItems?: ExpenseItem[]; // Add this new prop
}

export function OtherChargesPopup({
  isOpen,
  onClose,
  onSave,
  initialTotal,
  month,
  dueDate,
  disabled = false,
  existingItems = [], // Default to empty array
}: OtherChargesPopupProps) {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize expenses with existing items or default items
  useEffect(() => {
    if (isOpen) {
      // If we have existing items for this billing entry, use those
      if (existingItems.length > 0) {
        console.log(
          `Loading ${existingItems.length} existing expense items for month ${month}`
        );
        setExpenses(existingItems.map((item) => ({ ...item }))); // Deep copy
      }
      // Otherwise, create a default item based on the initial total
      else if (initialTotal > 0) {
        const defaultExpense = {
          id: `exp-${month}-${Date.now()}`, // Include month in ID for better uniqueness
          name: "Other charges",
          amount: initialTotal,
        };
        setExpenses([defaultExpense]);
      }
      // For new entries with no amount, start with an empty item
      else {
        setExpenses([
          {
            id: `exp-${month}-${Date.now()}`, // Include month in ID
            name: "",
            amount: 0,
          },
        ]);
      }
    }
  }, [isOpen, initialTotal, existingItems, month]);

  // Calculate the total of all expenses
  const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0);

  // Add a new expense item
  const addExpenseItem = () => {
    setExpenses([
      ...expenses,
      {
        id: `exp-${month}-${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 9)}`,
        name: "",
        amount: 0,
      },
    ]);
  };

  // Remove an expense item
  const removeExpenseItem = (id: string) => {
    // Don't allow removing the last item
    if (expenses.length <= 1) {
      toast.error("You must have at least one expense item");
      return;
    }

    setExpenses(expenses.filter((item) => item.id !== id));
  };

  // Update an expense item
  const updateExpenseItem = (
    id: string,
    field: "name" | "amount",
    value: string | number
  ) => {
    setExpenses(
      expenses.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            [field]: field === "amount" ? Number(value) || 0 : value,
          };
        }
        return item;
      })
    );
  };

  // Save changes
  const handleSave = () => {
    // Validate that all expenses have names
    const hasEmptyNames = expenses.some((item) => !item.name.trim());
    if (hasEmptyNames) {
      toast.error("All expense items must have a name");
      return;
    }

    setIsSubmitting(true);

    try {
      // Call the onSave callback with the total amount and expense items
      onSave(totalAmount, expenses);

      // Show success message
      toast.success("Other charges updated successfully");

      // Close the dialog
      onClose();
    } catch (error) {
      toast.error("Failed to save changes");
      console.error("Error saving other charges:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Edit Other Charges</DialogTitle>
          <DialogDescription>
            Month {month} - Due on {dueDate}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Expenses Table */}
          <div className="border rounded-md">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-2 px-4 font-medium">
                    Description
                  </th>
                  <th className="text-left py-2 px-4 font-medium">Amount</th>
                  <th className="w-10 py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="py-2 px-4">
                      <Input
                        value={item.name}
                        onChange={(e) =>
                          updateExpenseItem(item.id, "name", e.target.value)
                        }
                        placeholder="e.g., Utilities, Maintenance"
                        disabled={disabled}
                      />
                    </td>
                    <td className="py-2 px-4">
                      <div className="relative">
                        <span className="absolute left-3 top-2.5">₱</span>
                        <Input
                          type="number"
                          className="pl-7"
                          value={item.amount || ""}
                          onChange={(e) =>
                            updateExpenseItem(item.id, "amount", e.target.value)
                          }
                          placeholder="0"
                          disabled={disabled}
                        />
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeExpenseItem(item.id)}
                        disabled={disabled || expenses.length <= 1}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add New Item Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={addExpenseItem}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Add Expense Item
          </Button>

          <Separator />

          {/* Total */}
          <div className="flex justify-between items-center px-2">
            <Label className="font-medium text-base">
              Total Other Charges:
            </Label>
            <span className="text-xl font-bold">
              ₱{totalAmount.toLocaleString()}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={disabled || isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
