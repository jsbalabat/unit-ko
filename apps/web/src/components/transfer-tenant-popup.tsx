"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { api } from "@/lib/api-client";
import { transferTenant } from "@/services/tenantService";
import type { TenantListItem } from "@unitko/shared";

interface TransferTenantPopupProps {
  // The parent remounts this per tenant (keyed by id), so state starts clean.
  tenant: TenantListItem;
  isOpen: boolean;
  onClose: () => void;
  onTransferred: () => void;
}

export function TransferTenantPopup({
  tenant,
  isOpen,
  onClose,
  onTransferred,
}: TransferTenantPopupProps) {
  const [properties, setProperties] = useState<
    { id: string; unitName: string }[]
  >([]);
  const [destination, setDestination] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // The landlord's other properties are the transfer destinations; a failed load
  // just leaves the picker empty (the tenant can't be transferred to nowhere).
  useEffect(() => {
    let ignore = false;
    api.properties
      .list()
      .then((rows) => {
        if (ignore) return;
        setProperties(
          rows
            .filter((p) => p.id !== tenant.propertyId)
            .map((p) => ({ id: p.id, unitName: p.unitName })),
        );
      })
      .catch(() => {
        // Non-fatal; the picker stays empty.
      });
    return () => {
      ignore = true;
    };
  }, [tenant.propertyId]);

  const handleTransfer = async () => {
    if (!destination) return;
    setSubmitting(true);
    const outcome = await transferTenant(tenant.id, destination);
    setSubmitting(false);

    if (!outcome.success || !outcome.result) {
      toast.error("Transfer failed", {
        description: outcome.error ?? "Please try again.",
      });
      return;
    }

    const carried = outcome.result.transferredCount;
    toast.success(`${tenant.tenantName} transferred`, {
      description:
        carried > 0
          ? `${carried} open invoice${carried === 1 ? "" : "s"} carried over.`
          : "No open balance to carry.",
    });
    onTransferred();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => (!open && !submitting ? onClose() : null)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Transfer Tenant
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Move{" "}
            <span className="font-medium text-foreground">
              {tenant.tenantName}
            </span>
            {tenant.propertyName ? (
              <>
                {" "}
                from{" "}
                <span className="font-medium text-foreground">
                  {tenant.propertyName}
                </span>
              </>
            ) : null}{" "}
            to another unit. Their current lease terms and any open invoice
            balances carry over; fully-paid invoices stay on the current property.
          </p>

          <div className="space-y-1.5">
            <div className="text-sm font-medium">Destination property</div>
            <Select
              value={destination}
              onValueChange={setDestination}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a property..." />
              </SelectTrigger>
              <SelectContent>
                {properties.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No other properties to transfer to.
                  </div>
                ) : (
                  properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.unitName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleTransfer}
            disabled={submitting || !destination}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transfer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
