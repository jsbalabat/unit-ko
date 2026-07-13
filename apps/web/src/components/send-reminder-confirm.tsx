"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SendReminderConfirmProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  tenantName: string;
  propertyName: string;
  dueDate: string;
  totalAmount: number;
  message: string;
  isLoading?: boolean;
}

export function SendReminderConfirm({
  isOpen,
  onOpenChange,
  onConfirm,
  tenantName,
  propertyName,
  dueDate,
  totalAmount,
  message,
  isLoading = false,
}: SendReminderConfirmProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
      onOpenChange(false);
    }
  };

  const formattedDate = new Date(dueDate).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedAmount = totalAmount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Send Rent Reminder</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="space-y-3 px-4">
          <div className="text-sm text-foreground font-medium">
            Tenant: {tenantName}
          </div>
          <div className="text-sm text-foreground font-medium">
            Property: {propertyName}
          </div>
          <div className="text-sm text-foreground font-medium">
            Due Date: {formattedDate}
          </div>
          <div className="text-sm text-foreground font-medium">
            Amount: ₱{formattedAmount}
          </div>
          <div className="bg-muted p-3 rounded-md border border-border">
            <p className="text-xs text-muted-foreground mb-1 font-medium">
              Message:
            </p>
            <p className="text-sm text-foreground italic whitespace-pre-wrap">
              {message}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Note: You can only send one reminder per day to this tenant for this
            billing period.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isSubmitting || isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? "Sending..." : "Send"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
