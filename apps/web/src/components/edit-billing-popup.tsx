"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
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
import {
  Loader2,
  Building2,
  Receipt,
  RefreshCw,
  CreditCard,
} from "lucide-react";
import {
  InvoiceRow,
  RecordPaymentDialog,
  InvoiceHistorySheet,
  VoidPaymentDialog,
  type EditBillingPopupProps,
  type HistoryItem,
  type PaymentTypeValue,
  formatDateTime,
  peso,
} from "./edit-billing";

export type { EditBillingPopupProps };

// The two ledgers behind the history drawer, fetched together (shared by the
// open-effect and the post-void refresh so the drawer reflects the reversal).
function fetchHistory(
  id: string,
): Promise<[BillingRevision[], PaymentAllocation[]]> {
  return Promise.all([api.billing.revisions(id), api.billing.payments(id)]);
}

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
  // Available lease credit (unallocated overpayment surplus) — otherwise invisible
  // until it draws onto an invoice.
  const [availableCredit, setAvailableCredit] = useState(0);

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

  // Available lease credit, refetched whenever the invoice set changes (on open,
  // and after any payment/void/edit that could shift the pool). A failure just
  // hides the banner rather than breaking the list.
  useEffect(() => {
    const leaseId = invoices.find((e) => e.leaseId)?.leaseId ?? null;
    let ignore = false;
    // Resolve through a promise either way so no setState runs synchronously in
    // the effect body (which would cascade renders).
    Promise.resolve(
      leaseId ? api.billing.leaseCredit(leaseId).then((c) => c.available) : 0,
    )
      .then((available) => {
        if (!ignore) setAvailableCredit(available);
      })
      .catch(() => {
        if (!ignore) setAvailableCredit(0);
      });
    return () => {
      ignore = true;
    };
  }, [invoices]);

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
        paymentType: payType as PaymentTypeValue,
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
                {availableCredit > 0 && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                    <CreditCard className="h-4 w-4" />
                    <span className="font-semibold">
                      Lease credit available: {peso(availableCredit)}
                    </span>
                    <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
                      auto-applies to new charges, oldest invoice first
                    </span>
                  </div>
                )}
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
      <RecordPaymentDialog
        isOpen={payFor !== null}
        onClose={() => setPayFor(null)}
        payFor={payFor}
        payAmount={payAmount}
        setPayAmount={setPayAmount}
        payType={payType}
        setPayType={setPayType}
        payDate={payDate}
        setPayDate={setPayDate}
        payNotes={payNotes}
        setPayNotes={setPayNotes}
        isBusy={busyId !== null}
        onSubmitPayment={submitPayment}
      />

      {/* Invoice history — edits + payments */}
      <InvoiceHistorySheet
        isOpen={historyFor !== null}
        onClose={() => setHistoryFor(null)}
        historyFor={historyFor}
        historyLoading={historyLoading}
        historyError={historyError}
        historyItems={historyItems}
        onVoidTarget={(pay) => setVoidTarget(pay)}
      />

      {/* Void payment confirmation */}
      <VoidPaymentDialog
        isOpen={voidTarget !== null}
        voidTarget={voidTarget}
        voidReason={voidReason}
        setVoidReason={setVoidReason}
        voidBusy={voidBusy}
        onClose={() => {
          setVoidTarget(null);
          setVoidReason("");
        }}
        onConfirmVoid={confirmVoid}
      />
    </>
  );
}
