"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
}

interface SuggestedExpense {
  name: string;
  category: string;
}

interface OtherChargesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (total: number, items: ExpenseItem[]) => void;
  initialTotal?: number;
  month: number;
  dueDate: string;
  existingItems?: ExpenseItem[];
  disabled?: boolean;
}

export function OtherChargesPopup({
  isOpen,
  onClose,
  onSave,
  // initialTotal = 0,
  month,
  dueDate,
  existingItems = [],
  disabled = false,
}: OtherChargesPopupProps) {
  const [expenseItems, setExpenseItems] =
    useState<ExpenseItem[]>(existingItems);
  const [newItemName, setNewItemName] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");
  const [showCustomForm, setShowCustomForm] = useState(false);

  // Predefined expense suggestions
  const suggestedExpenses: SuggestedExpense[] = [
    {
      name: "Utilities (General)",
      category: "Utilities",
    },
    {
      name: "Water",
      category: "Utilities",
    },
    {
      name: "Electricity",
      category: "Utilities",
    },
    {
      name: "Internet & Cable",
      category: "Utilities",
    },
    {
      name: "Maintenance Fee",
      category: "Maintenance",
    },
    {
      name: "Homeowners Association",
      category: "Fees",
    },
    {
      name: "Parking Fee",
      category: "Fees",
    },
    {
      name: "Security Service",
      category: "Services",
    },
    {
      name: "Garbage Collection",
      category: "Services",
    },
    {
      name: "Property Insurance",
      category: "Insurance",
    },
    {
      name: "Pest Control",
      category: "Maintenance",
    },
    {
      name: "Cleaning Service",
      category: "Services",
    },
  ];

  useEffect(() => {
    if (existingItems.length > 0) {
      setExpenseItems(existingItems);
    }
  }, [existingItems]);

  const calculateTotal = () => {
    return expenseItems.reduce((sum, item) => sum + item.amount, 0);
  };

  const addSuggestedExpense = (suggestion: SuggestedExpense) => {
    const newItem: ExpenseItem = {
      id: `exp-${Date.now()}-${Math.random()}`,
      name: suggestion.name,
      amount: 0,
    };
    setExpenseItems([...expenseItems, newItem]);
    toast.success("Expense added", {
      description: `${suggestion.name} added. Please enter the amount.`,
    });
  };

  const addCustomExpense = () => {
    if (!newItemName.trim()) {
      toast.error("Please enter an expense name");
      return;
    }

    const amount = parseFloat(newItemAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const newItem: ExpenseItem = {
      id: `exp-${Date.now()}-${Math.random()}`,
      name: newItemName.trim(),
      amount: amount,
    };

    setExpenseItems([...expenseItems, newItem]);
    setNewItemName("");
    setNewItemAmount("");
    setShowCustomForm(false);

    toast.success("Custom expense added", {
      description: `${newItem.name} added successfully`,
    });
  };

  const updateExpenseAmount = (id: string, amount: number) => {
    setExpenseItems(
      expenseItems.map((item) =>
        item.id === id ? { ...item, amount: Math.max(0, amount) } : item,
      ),
    );
  };

  const removeExpense = (id: string) => {
    setExpenseItems(expenseItems.filter((item) => item.id !== id));
    toast.info("Expense removed");
  };

  const handleSave = () => {
    if (expenseItems.length === 0) {
      toast.error("Please add at least one expense item");
      return;
    }

    // Check for expenses with zero or empty amounts
    const emptyAmounts = expenseItems.filter((item) => item.amount <= 0);
    if (emptyAmounts.length > 0) {
      toast.error("Please enter amounts for all expenses");
      return;
    }

    const total = calculateTotal();
    onSave(total, expenseItems);
  };

  const handleCancel = () => {
    setExpenseItems(existingItems);
    setNewItemName("");
    setNewItemAmount("");
    setShowCustomForm(false);
    onClose();
  };

  // Filter out already added expenses from suggestions
  const availableSuggestions = suggestedExpenses.filter(
    (suggestion) => !expenseItems.some((item) => item.name === suggestion.name),
  );

  // Group suggestions by category
  const groupedSuggestions = availableSuggestions.reduce(
    (acc, suggestion) => {
      if (!acc[suggestion.category]) {
        acc[suggestion.category] = [];
      }
      acc[suggestion.category].push(suggestion);
      return acc;
    },
    {} as Record<string, SuggestedExpense[]>,
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            Other Charges - Month {month}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Due Date: {dueDate}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6">
          {/* Suggested Expenses Section */}
          {availableSuggestions.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold">Suggested Expenses</h3>
                <Badge variant="outline" className="text-xs">
                  {availableSuggestions.length} available
                </Badge>
              </div>

              <div className="space-y-3">
                {Object.entries(groupedSuggestions).map(
                  ([category, suggestions]) => (
                    <div key={category}>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {category}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {suggestions.map((suggestion) => (
                          <Button
                            key={suggestion.name}
                            variant="outline"
                            size="sm"
                            onClick={() => addSuggestedExpense(suggestion)}
                            disabled={disabled}
                            className="justify-start h-auto py-2 px-3 hover:bg-primary/5"
                          >
                            <span className="text-xs text-left">
                              {suggestion.name}
                            </span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          <Separator className="my-4" />

          {/* Custom Expense Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Custom Expense</h3>
              {!showCustomForm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCustomForm(true)}
                  disabled={disabled}
                  className="text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Custom
                </Button>
              )}
            </div>

            {showCustomForm && (
              <Card className="mb-4 border-dashed">
                <CardContent className="p-3 sm:p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="customName" className="text-xs">
                        Expense Name
                      </Label>
                      <Input
                        id="customName"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="e.g., Pool Maintenance"
                        className="h-8 text-sm"
                        disabled={disabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="customAmount" className="text-xs">
                        Amount (₱)
                      </Label>
                      <Input
                        id="customAmount"
                        type="number"
                        min="0"
                        value={newItemAmount}
                        onChange={(e) =>
                          setNewItemAmount(
                            e.target.value === "" ? "" : e.target.value,
                          )
                        }
                        placeholder="0.00"
                        className="h-8 text-sm"
                        disabled={disabled}
                      />
                    </div>
                  </div>
                  <div className=" gap-2 mt-4 flex">
                    <Button
                      size="sm"
                      onClick={addCustomExpense}
                      disabled={disabled}
                      className="p-1"
                    >
                      <Plus />
                      Add
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowCustomForm(false);
                        setNewItemName("");
                        setNewItemAmount("");
                      }}
                      className="text-s h-8"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Separator className="my-4" />

          {/* Current Expenses List */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-3">
              Added Expenses ({expenseItems.length})
            </h3>

            {expenseItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No expenses added yet</p>
                <p className="text-xs mt-1">
                  Add suggested or custom expenses above
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {expenseItems.map((item) => (
                  <Card key={item.id} className="shadow-sm">
                    <CardContent className="pl-4 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative w-28 sm:w-32">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              ₱
                            </span>
                            <Input
                              type="number"
                              min="0"
                              value={item.amount === 0 ? "" : item.amount}
                              onChange={(e) =>
                                updateExpenseAmount(
                                  item.id,
                                  e.target.value === ""
                                    ? 0
                                    : parseFloat(e.target.value) || 0,
                                )
                              }
                              placeholder="0.00"
                              className="h-8 text-sm pl-6 pr-2"
                              disabled={disabled}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeExpense(item.id)}
                            disabled={disabled}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Total Summary */}
          {expenseItems.length > 0 && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pl-4 pr-4 py-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">
                    Total Other Charges
                  </span>
                  <span className="text-lg font-bold text-primary">
                    ₱{calculateTotal().toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 border-t bg-muted/20">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1 sm:flex-none text-xs sm:text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={disabled || expenseItems.length === 0}
              className="flex-1 sm:flex-none text-xs sm:text-sm"
            >
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
