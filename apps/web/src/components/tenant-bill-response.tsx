"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  TENANT_RESPONSE_TYPES,
  type CreateTenantResponseInput,
  type TenantResponse,
  type TenantResponseType,
} from "@unitko/shared";
import { api } from "@/lib/api-client";
import { Button } from "@/components/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const RESPONSE_TYPE_OPTIONS: { value: TenantResponseType; label: string }[] = [
  { value: "acknowledged", label: "Acknowledged" },
  { value: "will_pay", label: "Will pay" },
  { value: "already_paid", label: "Already paid" },
  { value: "disputed", label: "Dispute" },
];

const RESPONSE_TYPE_SET = new Set<string>(TENANT_RESPONSE_TYPES);
function isResponseType(value: string): value is TenantResponseType {
  return RESPONSE_TYPE_SET.has(value);
}

interface TenantBillResponseProps {
  billingEntryId: string;
  existing: TenantResponse | null;
  onSubmitted: (response: TenantResponse) => void;
}

// Per-bill acknowledgement control. Once the tenant has responded it collapses to
// the recorded response + whether the landlord confirmed receipt.
export function TenantBillResponse({
  billingEntryId,
  existing,
  onSubmitted,
}: TenantBillResponseProps) {
  const [open, setOpen] = useState(false);
  const [responseType, setResponseType] =
    useState<TenantResponseType>("acknowledged");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const input: CreateTenantResponseInput = {
        billingEntryId,
        responseType,
        note: note.trim() ? note.trim() : undefined,
      };
      const created = await api.tenant.responses.create(input);
      onSubmitted(created);
      toast.success("Response sent to your landlord.");
      setOpen(false);
      setNote("");
      setResponseType("acknowledged");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send response.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (existing) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Badge variant="outline">{existing.responseTypeLabel}</Badge>
        <span className="text-xs text-muted-foreground">
          {existing.confirmedAt ? "Confirmed by landlord" : "Awaiting confirmation"}
        </span>
      </div>
    );
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Acknowledge
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Acknowledge this bill</DialogTitle>
            <DialogDescription>
              Let your landlord know where you stand on this invoice. You can add
              an optional note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="response-type">Response</Label>
              <Select
                value={responseType}
                onValueChange={(value) => {
                  if (isResponseType(value)) setResponseType(value);
                }}
              >
                <SelectTrigger id="response-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESPONSE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="response-note">Note (optional)</Label>
              <Textarea
                id="response-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder="Add any details for your landlord…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Sending…" : "Send response"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
