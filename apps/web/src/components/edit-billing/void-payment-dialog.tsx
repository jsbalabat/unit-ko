"use client";

import type { PaymentAllocation } from "@unitko/shared";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { peso } from "./types";

interface VoidPaymentDialogProps {
  isOpen: boolean;
  voidTarget: PaymentAllocation | null;
  voidReason: string;
  setVoidReason: (val: string) => void;
  voidBusy: boolean;
  onClose: () => void;
  onConfirmVoid: () => void;
}

export function VoidPaymentDialog({
  isOpen,
  voidTarget,
  voidReason,
  setVoidReason,
  voidBusy,
  onClose,
  onConfirmVoid,
}: VoidPaymentDialogProps) {
  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !voidBusy) {
          onClose();
        }
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Void this payment?</AlertDialogTitle>
          <AlertDialogDescription>
            {voidTarget
              ? `Reverses ${peso(voidTarget.amount)}. If this payment was split across periods (a waterfall), every part is reversed. It stays in the ledger for audit but no longer counts toward any balance.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 px-1">
          <Label htmlFor="void-reason" className="text-xs">
            Reason (optional)
          </Label>
          <Input
            id="void-reason"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="e.g. duplicate entry"
            maxLength={500}
            disabled={voidBusy}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={voidBusy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirmVoid();
            }}
            disabled={voidBusy}
            className="bg-red-600 hover:bg-red-700"
          >
            {voidBusy ? "Voiding..." : "Void payment"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
