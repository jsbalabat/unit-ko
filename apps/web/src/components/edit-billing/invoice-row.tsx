"use client";

import { useState } from "react";
import type {
  BillingChargeItem,
  BillingEntry,
  UpdateBillingEntryInput,
} from "@unitko/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/button";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil, History } from "lucide-react";
import { OtherChargesPopup } from "@/components/other-charges-popup";
import {
  chargesSignature,
  formatDateTime,
  peso,
  STATUS_TONE,
  sumCharges,
} from "./types";

interface InvoiceRowProps {
  invoice: BillingEntry;
  busy: boolean;
  onRecordPayment: () => void;
  onViewHistory: () => void;
  onSave: (body: UpdateBillingEntryInput) => void;
}

// Edits stage in a local draft and commit on one explicit Save → a single PATCH
// (the server recomputes status). Reset discards the draft; nothing auto-saves.
export function InvoiceRow({
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
  // Auto-applied lease credit, clamped to what's actually owed after cash — the
  // server caps it the same way, so an unedited invoice matches invoice.balance.
  // While editing rent/charges it's a live estimate; the server recomputes on save.
  const draftCredit = Math.min(
    invoice.appliedCredit,
    Math.max(0, draftGross - invoice.paidAmount),
  );
  const draftBalance = draftGross - invoice.paidAmount - draftCredit;

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
            {/* Paid is the effective settled amount: cash plus any applied credit,
                so it stays consistent with the balance below. */}
            <p className="font-medium">
              {peso(invoice.paidAmount + draftCredit)} / {peso(draftGross)}
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

        {draftCredit > 0 && (
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Lease credit applied: −{peso(draftCredit)}
          </p>
        )}

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
