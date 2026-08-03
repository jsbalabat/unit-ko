"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  BillingChargeItem,
  BillingEntry,
  BillingRevision,
  PaymentAllocation,
  UpdateBillingEntryInput,
} from "@unitko/shared";
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
import {
  Loader2,
  Building2,
  Receipt,
  Pencil,
  RefreshCw,
  History,
  CreditCard,
  ArrowDownToLine,
  Ban,
} from "lucide-react";
import { OtherChargesPopup } from "@/components/other-charges-popup";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_TONE: Record<string, string> = {
  Paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  Partial: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  Overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

function paymentTypeLabel(value: string): string {
  return PAYMENT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

// The two ledgers behind the history drawer, fetched together (shared by the
// open-effect and the post-void refresh so the drawer reflects the reversal).
function fetchHistory(
  id: string,
): Promise<[BillingRevision[], PaymentAllocation[]]> {
  return Promise.all([api.billing.revisions(id), api.billing.payments(id)]);
}

// One row of the invoice history drawer: an edit revision or a payment.
type HistoryItem =
  | { kind: "revision"; at: string; rev: BillingRevision }
  | { kind: "payment"; at: string; pay: PaymentAllocation };

// Per-tenant invoice manager. Reads the tenant's invoices (derived figures) and
// mutates only through the API: payments go to the ledger (POST /payments) and
// rent/charges/due-date edits go through PATCH /billing/entries/:id, which
// recomputes status server-side. Edits stage in a per-invoice draft and commit
// on one explicit Save (no field-level auto-save). Structural changes (lease
// terms, the schedule itself) live in the property editor — via onSwitchToProperty.
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

  // History drawer — an invoice's edits and payments, merged newest-first.
  const [historyFor, setHistoryFor] = useState<BillingEntry | null>(null);
  const [revisions, setRevisions] = useState<BillingRevision[]>([]);
  const [payments, setPayments] = useState<PaymentAllocation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Reversal confirmation: the payment pending void, an optional reason, and busy.
  const [voidTarget, setVoidTarget] = useState<PaymentAllocation | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidBusy, setVoidBusy] = useState(false);

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

  // Refetch after a mutation (record payment / save invoice) or the Refresh control.
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

  // Reset the history drawer when it opens for a different invoice — in render,
  // not the effect, to avoid a synchronous setState there.
  const historyId = historyFor?.id ?? null;
  const [lastHistoryId, setLastHistoryId] = useState(historyId);
  if (lastHistoryId !== historyId) {
    setLastHistoryId(historyId);
    setRevisions([]);
    setPayments([]);
    setHistoryError(null);
    setHistoryLoading(historyId !== null);
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

  useEffect(() => {
    if (!historyFor) return;
    let ignore = false;
    fetchHistory(historyFor.id)
      .then(([revs, pays]) => {
        if (ignore) return;
        setRevisions(revs);
        setPayments(pays);
      })
      .catch((err) => {
        if (!ignore)
          setHistoryError(
            err instanceof Error ? err.message : "Failed to load history",
          );
      })
      .finally(() => {
        if (!ignore) setHistoryLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [historyFor]);

  // Edits (editedAt) and payments (paidAt) interleaved, newest first.
  const historyItems = useMemo<HistoryItem[]>(
    () =>
      [
        ...revisions.map(
          (rev): HistoryItem => ({ kind: "revision", at: rev.editedAt, rev }),
        ),
        ...payments.map(
          (pay): HistoryItem => ({ kind: "payment", at: pay.paidAt, pay }),
        ),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [revisions, payments],
  );

  const tenantName = useMemo(
    () => invoices.find((e) => e.tenantName)?.tenantName ?? "this tenant",
    [invoices],
  );

  const lastUpdated = useMemo(() => {
    const stamps = invoices
      .map((e) => e.updatedAt)
      .filter((t): t is string => Boolean(t));
    return stamps.length ? stamps.reduce((a, b) => (b > a ? b : a)) : null;
  }, [invoices]);

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

  const refreshHistory = useCallback(async () => {
    if (!historyFor) return;
    const [revs, pays] = await fetchHistory(historyFor.id);
    setRevisions(revs);
    setPayments(pays);
  }, [historyFor]);

  // Reverse a payment: voiding restores balances across every invoice its batch
  // touched, so refresh both the invoice list and the open history drawer.
  const confirmVoid = async () => {
    if (!voidTarget) return;
    setVoidBusy(true);
    try {
      const result = await api.payments.void(voidTarget.batchId, {
        reason: voidReason.trim() || undefined,
      });
      toast.success(
        result.voidedCount > 1
          ? `Payment voided — ${result.voidedCount} allocations reversed`
          : "Payment voided",
      );
      setVoidTarget(null);
      setVoidReason("");
      await Promise.all([load(), refreshHistory()]);
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Failed to void payment",
      );
    } finally {
      setVoidBusy(false);
    }
  };

  // One PATCH carrying the whole draft; the server recomputes status atomically.
  const saveEntry = async (
    invoice: BillingEntry,
    body: UpdateBillingEntryInput,
  ) => {
    setBusyId(invoice.id);
    try {
      await api.billing.update(invoice.id, body);
      toast.success(`Period ${invoice.sequence ?? "—"} updated`);
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
              Record payments and adjust invoices. Edits stage as a draft and
              save on demand; balances and status are computed automatically.
            </DialogDescription>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground">
                Last updated {formatDateTime(lastUpdated)}
              </p>
            )}
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
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void load()}
                    disabled={loading}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Refresh
                  </Button>
                </div>
                {invoices.map((invoice) => (
                  <InvoiceRow
                    key={invoice.id}
                    invoice={invoice}
                    busy={busyId === invoice.id}
                    onRecordPayment={() => openPayment(invoice)}
                    onViewHistory={() => setHistoryFor(invoice)}
                    onSave={(body) => saveEntry(invoice, body)}
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

      {/* Invoice history — edits + payments */}
      <Sheet
        open={historyFor !== null}
        onOpenChange={(open) => (!open ? setHistoryFor(null) : null)}
      >
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
                            onClick={() => setVoidTarget(item.pay)}
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

      <AlertDialog
        open={voidTarget !== null}
        onOpenChange={(open) => {
          if (!open && !voidBusy) {
            setVoidTarget(null);
            setVoidReason("");
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
                confirmVoid();
              }}
              disabled={voidBusy}
              className="bg-red-600 hover:bg-red-700"
            >
              {voidBusy ? "Voiding..." : "Void payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface InvoiceRowProps {
  invoice: BillingEntry;
  busy: boolean;
  onRecordPayment: () => void;
  onViewHistory: () => void;
  onSave: (body: UpdateBillingEntryInput) => void;
}

function chargesSignature(charges: BillingChargeItem[]): string {
  return charges.map((c) => `${c.name}:${c.amount}`).join("|");
}

function sumCharges(charges: BillingChargeItem[]): number {
  return charges.reduce((total, c) => total + c.amount, 0);
}

// Edits stage in a local draft and commit on one explicit Save → a single PATCH
// (the server recomputes status). Reset discards the draft; nothing auto-saves.
function InvoiceRow({
  invoice,
  busy,
  onRecordPayment,
  onViewHistory,
  onSave,
}: InvoiceRowProps) {
  const [draftRent, setDraftRent] = useState(String(invoice.rentDue));
  const [draftDate, setDraftDate] = useState(invoice.dueDate ?? "");
  const [draftCharges, setDraftCharges] = useState<BillingChargeItem[]>(
    invoice.charges,
  );
  const [editingCharges, setEditingCharges] = useState(false);

  // Resync the draft when the persisted invoice changes (e.g. a save bumps
  // updatedAt) — in render, not an effect, to avoid a synchronous setState there.
  const version = [
    invoice.rentDue,
    invoice.dueDate ?? "",
    invoice.updatedAt ?? "",
    chargesSignature(invoice.charges),
  ].join("§");
  const [lastVersion, setLastVersion] = useState(version);
  if (lastVersion !== version) {
    setLastVersion(version);
    setDraftRent(String(invoice.rentDue));
    setDraftDate(invoice.dueDate ?? "");
    setDraftCharges(invoice.charges);
  }

  const rentNum = Number(draftRent);
  const rentValid = draftRent !== "" && Number.isFinite(rentNum) && rentNum >= 0;
  const rentChanged = rentValid && rentNum !== invoice.rentDue;
  const dateChanged = draftDate !== "" && draftDate !== (invoice.dueDate ?? "");
  const chargesChanged =
    chargesSignature(draftCharges) !== chargesSignature(invoice.charges);
  const dirty = rentChanged || dateChanged || chargesChanged;

  const draftOtherCharges = sumCharges(draftCharges);
  const draftGross = (rentValid ? rentNum : invoice.rentDue) + draftOtherCharges;
  const draftBalance = draftGross - invoice.paidAmount;

  const reset = () => {
    setDraftRent(String(invoice.rentDue));
    setDraftDate(invoice.dueDate ?? "");
    setDraftCharges(invoice.charges);
  };

  const save = () => {
    const body: UpdateBillingEntryInput = {};
    if (rentChanged) body.rentDue = rentNum;
    if (dateChanged) body.dueDate = draftDate;
    if (chargesChanged) body.charges = draftCharges;
    if (Object.keys(body).length > 0) onSave(body);
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
            {dirty && (
              <Badge
                variant="outline"
                className="text-[10px] border-amber-300 text-amber-600"
              >
                Unsaved
              </Badge>
            )}
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          </div>
          <Input
            type="date"
            aria-label="Due date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            className="h-7 w-36 text-xs"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Rent</p>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={draftRent}
              onChange={(e) => setDraftRent(e.target.value)}
              className="h-7 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Other charges</p>
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium hover:text-primary"
              onClick={() => setEditingCharges(true)}
            >
              {peso(draftOtherCharges)}
              <Pencil className="h-3 w-3" />
            </button>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Paid / Due</p>
            <p className="font-medium">
              {peso(invoice.paidAmount)} / {peso(draftGross)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Balance</p>
            <p
              className={`font-semibold ${
                draftBalance > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-green-600 dark:text-green-400"
              }`}
            >
              {peso(draftBalance)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {dirty ? (
              <>
                <Button size="sm" onClick={save} disabled={busy || !rentValid}>
                  Save changes
                </Button>
                <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
                  Reset
                </Button>
              </>
            ) : (
              invoice.updatedAt && (
                <span className="text-[11px] text-muted-foreground">
                  Updated {formatDateTime(invoice.updatedAt)}
                </span>
              )
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={onViewHistory}
              disabled={busy}
            >
              <History className="h-3.5 w-3.5 mr-1" />
              History
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onRecordPayment}
              disabled={busy}
            >
              Record Payment
            </Button>
          </div>
        </div>
      </CardContent>

      {editingCharges && (
        <OtherChargesPopup
          isOpen
          onClose={() => setEditingCharges(false)}
          month={invoice.sequence ?? 0}
          dueDate={draftDate || invoice.dueDate || ""}
          existingItems={draftCharges.map((c, i) => ({
            id: `charge-${i}`,
            name: c.name,
            amount: c.amount,
          }))}
          onSave={(_total, items) => {
            setDraftCharges(
              items.map((i) => ({ name: i.name, amount: i.amount })),
            );
            setEditingCharges(false);
          }}
        />
      )}
    </Card>
  );
}
