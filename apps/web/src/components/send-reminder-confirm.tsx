"use client";

import { useState } from "react";
import { buildReminderMessage, type ReminderChannel } from "@unitko/shared";
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
  onConfirm: (channel: ReminderChannel) => Promise<void>;
  tenantName: string;
  tenantPhone: string;
  propertyName: string;
  dueDate: string;
  totalAmount: number;
  isLoading?: boolean;
}

export function SendReminderConfirm({
  isOpen,
  onOpenChange,
  onConfirm,
  tenantName,
  tenantPhone,
  propertyName,
  dueDate,
  totalAmount,
  isLoading = false,
}: SendReminderConfirmProps) {
  // Which channel is mid-send, so only that button shows "Sending..." while both
  // stay disabled. null when idle.
  const [submitting, setSubmitting] = useState<ReminderChannel | null>(null);
  const busy = submitting !== null || isLoading;
  const hasPhone = tenantPhone.trim().length > 0;

  const handleConfirm = async (channel: ReminderChannel) => {
    setSubmitting(channel);
    try {
      await onConfirm(channel);
    } finally {
      setSubmitting(null);
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

  // Previews come from the same builder the API dispatches with, so what the
  // landlord sees is exactly what the tenant receives on each channel.
  const emailMessage = buildReminderMessage(
    "email",
    tenantName,
    propertyName,
    dueDate,
    totalAmount,
  );
  const smsMessage = buildReminderMessage(
    "sms",
    tenantName,
    propertyName,
    dueDate,
    totalAmount,
  );

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
          <div className="text-sm text-foreground font-medium">
            Mobile: {hasPhone ? tenantPhone : "Not on file"}
          </div>

          <div className="bg-muted p-3 rounded-md border border-border">
            <p className="text-xs text-muted-foreground mb-1 font-medium">
              Email message:
            </p>
            <p className="text-sm text-foreground italic whitespace-pre-wrap">
              {emailMessage}
            </p>
          </div>
          <div className="bg-muted p-3 rounded-md border border-border">
            <p className="text-xs text-muted-foreground mb-1 font-medium">
              SMS message:
            </p>
            <p className="text-sm text-foreground italic whitespace-pre-wrap">
              {smsMessage}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Note: You can only send one reminder per day to this tenant for this
            billing period, per channel.
          </p>
        </div>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleConfirm("email")}
            disabled={busy}
          >
            {submitting === "email" ? "Sending..." : "Send to Email"}
          </AlertDialogAction>
          <AlertDialogAction
            onClick={() => handleConfirm("sms")}
            disabled={busy || !hasPhone}
            title={hasPhone ? undefined : "No mobile number on file for this tenant"}
          >
            {submitting === "sms" ? "Sending..." : "Send to SMS"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
