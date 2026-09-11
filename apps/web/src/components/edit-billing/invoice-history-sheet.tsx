"use client";

import type { BillingEntry, PaymentAllocation } from "@unitko/shared";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/button";
import {
  Loader2,
  Pencil,
  CreditCard,
  Ban,
  ArrowDownToLine,
} from "lucide-react";
import {
  formatDateTime,
  paymentTypeLabel,
  peso,
  STATUS_TONE,
  type HistoryItem,
} from "./types";

interface InvoiceHistorySheetProps {
  isOpen: boolean;
  onClose: () => void;
  historyFor: BillingEntry | null;
  historyLoading: boolean;
  historyError: string | null;
  historyItems: HistoryItem[];
  onVoidTarget: (payment: PaymentAllocation) => void;
}

export function InvoiceHistorySheet({
  isOpen,
  onClose,
  historyFor,
  historyLoading,
  historyError,
  historyItems,
  onVoidTarget,
}: InvoiceHistorySheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>History</SheetTitle>
          <SheetDescription>
            {historyFor
              ? `Period ${historyFor.sequence ?? "—"} — edits and payments, newest first.`
              : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-3">
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : historyError ? (
            <div className="py-8 text-center text-sm text-destructive">
              {historyError}
            </div>
          ) : historyItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No edits or payments recorded yet.
            </div>
          ) : (
            historyItems.map((item) =>
              item.kind === "revision" ? (
                <Card key={`rev-${item.rev.id}`} className="border">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Pencil className="h-3.5 w-3.5" />
                        {formatDateTime(item.rev.editedAt)}
                      </span>
                      <Badge
                        className={
                          STATUS_TONE[item.rev.status] ??
                          "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                        }
                      >
                        {item.rev.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-[11px] text-muted-foreground">Rent</p>
                        <p className="font-medium">{peso(item.rev.rentDue)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Other</p>
                        <p className="font-medium">
                          {peso(item.rev.otherCharges)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Gross</p>
                        <p className="font-medium">{peso(item.rev.grossDue)}</p>
                      </div>
                    </div>
                    {item.rev.charges.length > 0 && (
                      <div className="border-t pt-2 space-y-1 text-xs text-muted-foreground">
                        {item.rev.charges.map((c, i) => (
                          <div key={i} className="flex justify-between gap-2">
                            <span className="truncate">{c.name}</span>
                            <span>{peso(c.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card
                  key={`pay-${item.pay.id}`}
                  className={item.pay.voidedAt ? "border opacity-60" : "border"}
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-green-600" />
                        {formatDateTime(item.pay.paidAt)}
                      </span>
                      {item.pay.voidedAt ? (
                        <Badge className="gap-1 bg-muted text-muted-foreground">
                          <Ban className="h-3 w-3" />
                          Voided
                        </Badge>
                      ) : item.pay.isOverflow ? (
                        <Badge className="gap-1 bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300">
                          <ArrowDownToLine className="h-3 w-3" />
                          Waterfall
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                          Payment
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={
                          item.pay.voidedAt
                            ? "text-sm font-semibold text-muted-foreground line-through"
                            : "text-sm font-semibold text-green-700 dark:text-green-400"
                        }
                      >
                        +{peso(item.pay.amount)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {paymentTypeLabel(item.pay.paymentType)}
                      </span>
                    </div>
                    {item.pay.isOverflow && (
                      <p className="text-[11px] text-muted-foreground">
                        Cascaded here from an overpayment on another period.
                      </p>
                    )}
                    {item.pay.notes && (
                      <p className="border-t pt-2 text-xs text-muted-foreground">
                        {item.pay.notes}
                      </p>
                    )}
                    {!item.pay.voidedAt && (
                      <div className="flex justify-end border-t pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                          onClick={() => onVoidTarget(item.pay)}
                        >
                          <Ban className="h-3 w-3" />
                          Void
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ),
            )
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
