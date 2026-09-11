"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { User, Plus, Minus, Loader2 } from "lucide-react";

export interface PropertyPaymentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTenantIndex: number | null;
  tenantProfiles: Array<{ name: string; email: string; phone: string }>;
  paymentAmount: number;
  setPaymentAmount: (amount: number) => void;
  paymentType: string;
  setPaymentType: (type: string) => void;
  receiptDate: string;
  setReceiptDate: (date: string) => void;
  paymentNote: string;
  setPaymentNote: (note: string) => void;
  isApplyingPayment: boolean;
  onApplyPayment: () => Promise<void>;
  onCancel: () => void;
}

export function PropertyPaymentDialog({
  isOpen,
  onOpenChange,
  selectedTenantIndex,
  tenantProfiles,
  paymentAmount,
  setPaymentAmount,
  paymentType,
  setPaymentType,
  receiptDate,
  setReceiptDate,
  paymentNote,
  setPaymentNote,
  isApplyingPayment,
  onApplyPayment,
  onCancel,
}: PropertyPaymentDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base sm:text-lg">
            Apply Payment
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Enter payment amount and type. Rent applies to billing entries.
          </DialogDescription>
          {selectedTenantIndex !== null &&
            tenantProfiles[selectedTenantIndex] && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 mt-2">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                    <User className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-xs text-blue-900 dark:text-blue-100">
                    <span className="font-medium">Applying to: </span>
                    <span className="font-semibold">
                      {tenantProfiles[selectedTenantIndex].name}
                    </span>
                  </p>
                </div>
              </div>
            )}
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="payment-amount" className="text-xs sm:text-sm">
              Payment Amount
            </Label>
            <div className="flex gap-1.5">
              <Input
                id="payment-amount"
                type="number"
                value={paymentAmount || ""}
                onChange={(e) => {
                  const value = e.target.value.replace(/^0+(?=\d)/, "");
                  setPaymentAmount(parseInt(value, 10) || 0);
                }}
                placeholder="Enter amount"
                className="h-8 sm:h-9 flex-1 text-xs sm:text-sm"
              />
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant={paymentAmount >= 0 ? "default" : "outline"}
                  size="icon"
                  className={`h-8 w-8 sm:h-9 sm:w-9 ${
                    paymentAmount >= 0
                      ? "!bg-emerald-500 hover:!bg-emerald-600 !text-white"
                      : ""
                  }`}
                  onClick={() => setPaymentAmount(Math.abs(paymentAmount))}
                  disabled={paymentAmount >= 0}
                >
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  type="button"
                  variant={paymentAmount < 0 ? "default" : "outline"}
                  size="icon"
                  className={`h-8 w-8 sm:h-9 sm:w-9 ${
                    paymentAmount < 0
                      ? "!bg-red-500 hover:!bg-red-600 !text-white"
                      : ""
                  }`}
                  onClick={() => setPaymentAmount(-Math.abs(paymentAmount))}
                  disabled={paymentAmount <= 0}
                >
                  <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="payment-type" className="text-xs sm:text-sm">
                Payment Type
              </Label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger
                  id="payment-type"
                  className="h-8 sm:h-9 text-xs sm:text-sm w-full"
                >
                  <SelectValue placeholder="Choose Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent" className="text-xs sm:text-sm">
                    Rent Due
                  </SelectItem>
                  <SelectItem value="deposit" className="text-xs sm:text-sm">
                    Security Deposit
                  </SelectItem>
                  <SelectItem value="advance" className="text-xs sm:text-sm">
                    Advance Payment
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 flex-1">
              <Label htmlFor="receipt-date" className="text-xs sm:text-sm">
                Receipt Date
              </Label>
              <Input
                id="receipt-date"
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="h-8 sm:h-9 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-note" className="text-xs sm:text-sm">
              Note
            </Label>
            <Input
              id="payment-note"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Optional note..."
              className="h-8 sm:h-9 text-xs sm:text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isApplyingPayment}
            className="h-8 sm:h-9 text-xs sm:text-sm"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onApplyPayment}
            disabled={isApplyingPayment || paymentAmount === 0 || !paymentType}
            className="gap-1.5 h-8 sm:h-9 text-xs sm:text-sm"
          >
            {isApplyingPayment ? (
              <>
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                Applying...
              </>
            ) : (
              <>Apply Payment</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
