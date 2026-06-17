"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { BillingEntry } from "@unitko/shared";
import { api, ApiError } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Building2, Receipt, Pencil } from "lucide-react";
import { OtherChargesPopup } from "@/components/other-charges-popup";

interface EditBillingPopupProps {
  propertyId: string;
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSwitchToProperty?: () => void;
}

const PAYMENT_TYPE_OPTIONS = [
  { value: "rent", label: "Rent" },
  { value: "deposit", label: "Deposit" },
  { value: "advance", label: "Advance" },
] as const;

function peso(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const STATUS_TONE: Record<string, string> = {
  Paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  Partial: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  Overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

// Per-tenant invoice manager. Reads the tenant's invoices (derived figures) and
// mutates only through the API: payments go to the ledger (POST /payments) and
// rent/charges/due-date edits go through PATCH /billing/entries/:id, which
// recomputes status server-side. Structural changes (lease terms, the schedule
// itself) live in the property editor — reachable via onSwitchToProperty.
export function EditBillingPopup({
  propertyId,
  tenantId,
  isOpen,
  onClose,
  onSuccess,
  onSwitchToProperty,
}: EditBillingPopupProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<BillingEntry[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Record-payment dialog.
  const [payFor, setPayFor] = useState<BillingEntry | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payType, setPayType] = useState<string>("rent");
  const [payDate, setPayDate] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // Charges editor (reuses the add-property charges popup).
  const [chargesFor, setChargesFor] = useState<BillingEntry | null>(null);

  // Pure fetch: this tenant's invoices, no state writes.
  const fetchInvoices = useCallback(
    () =>
      api.billing
        .list(propertyId)
        .then((all) => all.filter((e) => e.tenantId === tenantId)),
    [propertyId, tenantId],
  );

  const applyInvoices = useCallback((rows: BillingEntry[]) => {
    setInvoices(rows);
    setError(null);
  }, []);

  // Manual refresh after a mutation (record payment / edit charges).
  const load = useCallback(() => {
    setLoading(true);
    return fetchInvoices()
      .then(applyInvoices)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load billing"),
      )
      .finally(() => setLoading(false));
  }, [fetchInvoices, applyInvoices]);

  // Re-enter the loading state each time the popup opens — done during render
  // rather than in the open-effect, which would be a synchronous setState there.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) setLoading(true);
  }

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;
    fetchInvoices()
      .then((rows) => {
        if (!ignore) applyInvoices(rows);
      })
      .catch((err) => {
        if (!ignore)
          setError(
            err instanceof Error ? err.message : "Failed to load billing",
          );
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [isOpen, fetchInvoices, applyInvoices]);

  const tenantName = useMemo(
    () => invoices.find((e) => e.tenantName)?.tenantName ?? "this tenant",
    [invoices],
  );

  const openPayment = (invoice: BillingEntry) => {
    setPayFor(invoice);
    setPayAmount(invoice.balance > 0 ? String(invoice.balance) : "");
    setPayType("rent");
    setPayDate("");
    setPayNotes("");
  };

  const submitPayment = async () => {
    if (!payFor) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    setBusyId(payFor.id);
    try {
      await api.payments.record({
        billingEntryId: payFor.id,
        amount,
        paymentType: payType as (typeof PAYMENT_TYPE_OPTIONS)[number]["value"],
        paidAt: payDate ? new Date(payDate).toISOString() : undefined,
        notes: payNotes.trim() || undefined,
      });
      toast.success(`Payment of ${peso(amount)} recorded`);
      setPayFor(null);
      await load();
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Failed to record payment",
      );
    } finally {
      setBusyId(null);
    }
  };

  const patchEntry = async (
    invoice: BillingEntry,
    body: Parameters<typeof api.billing.update>[1],
  ) => {
    setBusyId(invoice.id);
    try {
      await api.billing.update(invoice.id, body);
      await load();
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Failed to update invoice",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Billing — {tenantName}
            </DialogTitle>
            <DialogDescription>
              Record payments and adjust invoices. Balances and status are
              computed automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="py-8 text-center text-sm text-destructive">
                {error}
              </div>
            ) : invoices.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No invoices for {tenantName} yet.
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    busy={busyId === invoice.id}
                    onRecordPayment={() => openPayment(invoice)}
                    onEditCharges={() => setChargesFor(invoice)}
                    onSaveRent={(rentDue) => patchEntry(invoice, { rentDue })}
                    onSaveDueDate={(dueDate) => patchEntry(invoice, { dueDate })}
                  />
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/20 sm:justify-between">
            {onSwitchToProperty ? (
              <Button variant="outline" onClick={onSwitchToProperty}>
                <Building2 className="h-4 w-4 mr-2" />
                Edit lease / schedule
              </Button>
            ) : (
              <span />
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record payment */}
      <Dialog open={payFor !== null} onOpenChange={(open) => (!open ? setPayFor(null) : null)}>
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
            <Button variant="outline" onClick={() => setPayFor(null)}>
              Cancel
            </Button>
            <Button onClick={submitPayment} disabled={busyId !== null}>
              {busyId !== null ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit charges */}
      {chargesFor && (
        <OtherChargesPopup
          isOpen={chargesFor !== null}
          onClose={() => setChargesFor(null)}
          month={chargesFor.sequence ?? 0}
          dueDate={chargesFor.dueDate ?? ""}
          existingItems={chargesFor.charges.map((c, i) => ({
            id: `charge-${i}`,
            name: c.name,
            amount: c.amount,
          }))}
          onSave={(_total, items) => {
            const target = chargesFor;
            setChargesFor(null);
            void patchEntry(target, {
              charges: items.map((i) => ({ name: i.name, amount: i.amount })),
            });
          }}
        />
      )}
    </>
  );
}

interface InvoiceRowProps {
  invoice: BillingEntry;
  busy: boolean;
  onRecordPayment: () => void;
  onEditCharges: () => void;
  onSaveRent: (rentDue: number) => void;
  onSaveDueDate: (dueDate: string) => void;
}

function InvoiceRow({
  invoice,
  busy,
  onRecordPayment,
  onEditCharges,
  onSaveRent,
  onSaveDueDate,
}: InvoiceRowProps) {
  const [editingRent, setEditingRent] = useState(false);
  const [rentValue, setRentValue] = useState(String(invoice.rentDue));
  const [editingDate, setEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState(invoice.dueDate ?? "");

  const commitRent = () => {
    const next = Number(rentValue);
    setEditingRent(false);
    if (Number.isFinite(next) && next >= 0 && next !== invoice.rentDue) {
      onSaveRent(next);
    }
  };

  const commitDate = () => {
    setEditingDate(false);
    if (dateValue && dateValue !== invoice.dueDate) onSaveDueDate(dateValue);
  };

  return (
    <Card className="border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">
              Period {invoice.sequence ?? "—"}
            </span>
            <Badge
              className={
                STATUS_TONE[invoice.status] ??
                "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
              }
            >
              {invoice.status}
            </Badge>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </div>
          <div className="text-xs text-muted-foreground">
            {editingDate ? (
              <Input
                type="date"
                autoFocus
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                onBlur={commitDate}
                className="h-7 w-36 text-xs"
              />
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-foreground"
                onClick={() => setEditingDate(true)}
              >
                Due {invoice.dueDate ?? "—"}
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Rent</p>
            {editingRent ? (
              <Input
                type="number"
                autoFocus
                min="0"
                value={rentValue}
                onChange={(e) => setRentValue(e.target.value)}
                onBlur={commitRent}
                className="h-7 text-sm"
              />
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium hover:text-primary"
                onClick={() => setEditingRent(true)}
              >
                {peso(invoice.rentDue)}
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Other charges</p>
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium hover:text-primary"
              onClick={onEditCharges}
            >
              {peso(invoice.otherCharges)}
              <Pencil className="h-3 w-3" />
            </button>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Paid / Due</p>
            <p className="font-medium">
              {peso(invoice.paidAmount)} / {peso(invoice.grossDue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Balance</p>
            <p
              className={`font-semibold ${
                invoice.balance > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-green-600 dark:text-green-400"
              }`}
            >
              {peso(invoice.balance)}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={onRecordPayment} disabled={busy}>
            Record Payment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
