"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import { Archive } from "lucide-react";
import {
  BillingEntry,
  formatDate,
  formatCurrency,
  getStatusColorClass,
} from "./types";

export interface PropertyTransferredDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  archivedTransfers: BillingEntry[];
  tenantDirectory: Map<string, { name: string; property: string | null }>;
}

export function PropertyTransferredDialog({
  isOpen,
  onOpenChange,
  archivedTransfers,
  tenantDirectory,
}: PropertyTransferredDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            Transferred Invoices
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            These invoices moved to another unit when the tenant was
            transferred. Their open balance is now billed on the destination
            lease, so they no longer appear in the statement above.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          <ul className="divide-y">
            {archivedTransfers.map((entry) => {
              const info = entry.tenant_id
                ? tenantDirectory.get(entry.tenant_id)
                : null;
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium">
                      {formatDate(entry.due_date)}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {info?.name ?? "—"}
                      {info?.property ? ` · now in ${info.property}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-medium">
                      {formatCurrency(entry.gross_due)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColorClass(
                        "transferred",
                      )}`}
                    >
                      Transferred
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
