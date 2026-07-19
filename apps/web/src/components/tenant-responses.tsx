"use client";

import { useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";
import useSWR from "swr";
import { api } from "@/lib/api-client";
import { liveFeedOptions } from "@/lib/swr";
import { useShowMore } from "@/hooks/useShowMore";
import { ShowMoreToggle } from "@/components/show-more-toggle";
import { CollapsibleSection } from "@/components/collapsible-section";
import { Button } from "@/components/button";
import { formatDateTime } from "@/lib/format";

// The tenant-response feed: how tenants have replied to their bills (acknowledged
// / will pay / already paid / disputed), with a one-click receipt confirmation.
// Auto-revalidates on focus/reconnect and a slow interval (see liveFeedOptions).
export function TenantResponses() {
  const {
    data: responses,
    error,
    mutate,
  } = useSWR("landlord-responses", () => api.responses.list(8), liveFeedOptions);
  const {
    visible: visibleResponses,
    hiddenCount,
    expanded,
    toggle,
  } = useShowMore(responses ?? [], 3);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Queued = responses the landlord still has to confirm receipt on. Confirming
  // one drops the count, so the header doubles as the remaining to-do.
  const queuedCount = (responses ?? []).filter((r) => !r.confirmedAt).length;

  const handleConfirm = async (id: string) => {
    setConfirmingId(id);
    setConfirmError(null);
    try {
      const updated = await api.responses.confirm(id);
      // The API returns the authoritative confirmed row; patch the cache in place
      // rather than pay for a refetch.
      await mutate(
        (current) => (current ?? []).map((r) => (r.id === id ? updated : r)),
        { revalidate: false },
      );
    } catch (err) {
      setConfirmError(
        err instanceof Error ? err.message : "Failed to confirm receipt",
      );
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <CollapsibleSection
      title="Tenant Responses"
      icon={<ClipboardCheck className="h-3.5 w-3.5" />}
      badgeCount={queuedCount}
    >
      {responses === undefined && error ? (
        <p className="py-2 text-sm text-destructive">Failed to load responses</p>
      ) : responses === undefined ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : responses.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          No tenant responses yet.
        </p>
      ) : (
        <>
          {confirmError ? (
            <p className="mb-2 text-xs text-destructive">{confirmError}</p>
          ) : null}
          <ul className="space-y-2.5">
            {visibleResponses.map((r) => (
              <li
                key={r.id}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {r.tenantName ?? "Unknown tenant"}
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      · {r.responseTypeLabel}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.propertyName ?? "—"} · {formatDateTime(r.createdAt)}
                  </p>
                  {r.note ? (
                    <p className="mt-0.5 truncate text-xs italic text-muted-foreground">
                      “{r.note}”
                    </p>
                  ) : null}
                </div>
                {r.confirmedAt ? (
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-green-700 dark:text-green-400">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Confirmed
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleConfirm(r.id)}
                    disabled={confirmingId === r.id}
                  >
                    {confirmingId === r.id ? "Confirming…" : "Confirm receipt"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <ShowMoreToggle
            expanded={expanded}
            hiddenCount={hiddenCount}
            onToggle={toggle}
          />
        </>
      )}
    </CollapsibleSection>
  );
}
