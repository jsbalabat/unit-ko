"use client";

import type { BillingEntry } from "@unitko/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { PAYMENT_TYPE_OPTIONS, peso } from "./types";

interface RecordPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  payFor: BillingEntry | null;
  payAmount: string;
  setPayAmount: (val: string) => void;
  payType: string;
  setPayType: (val: string) => void;
  payDate: string;
  setPayDate: (val: string) => void;
  payNotes: string;
  setPayNotes: (val: string) => void;
  isBusy: boolean;
  onSubmitPayment: () => void;
}

export function RecordPaymentDialog({
  isOpen,
  onClose,
  payFor,
  payAmount,
  setPayAmount,
  payType,
  setPayType,
  payDate,
  setPayDate,
  payNotes,
  setPayNotes,
  isBusy,
  onSubmitPayment,
}: RecordPaymentDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            {payFor &&
              `Period ${payFor.sequence ?? "—"} · balance ${peso(payFor.balance)}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pay-amount">Amount (₱)</Label>
            <Input
              id="pay-amount"
              type="number"
              min="0"
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={payType} onValueChange={setPayType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-date">Date (optional)</Label>
              <Input
                id="pay-date"
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-notes">Notes (optional)</Label>
            <Input
              id="pay-notes"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="Reference, channel, etc."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmitPayment} disabled={isBusy}>
            {isBusy ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
