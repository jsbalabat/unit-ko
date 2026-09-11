"use client";

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

interface SwitchBillingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmSwitch: () => void;
}

export function SwitchBillingDialog({
  isOpen,
  onOpenChange,
  onConfirmSwitch,
}: SwitchBillingDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Switch to Edit Billing?</AlertDialogTitle>
          <AlertDialogDescription>
            Any unsaved changes will be lost. Are you sure you want to switch
            to Edit Billing?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmSwitch}>
            Switch
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
