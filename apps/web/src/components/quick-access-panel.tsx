"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import type { Subscription } from "@unitko/shared";
import { fetchUserSubscription } from "@/services/subscriptionService";
import { CollapsibleCard } from "@/components/collapsible-card";
import { ReminderActivity } from "@/components/reminder-activity";
import { TenantResponses } from "@/components/tenant-responses";
import { peso, formatDate } from "@/lib/format";

// "One Look. One Click." — a consolidated dashboard panel: the landlord's own
// SaaS bill to UnitKo, the reminder-dispatch cycle, and how tenants have
// responded to their bills.
export function QuickAccessPanel({ actions }: { actions?: ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    fetchUserSubscription()
      .then((sub) => {
        if (!ignore) setSubscription(sub);
      })
      .catch((err) => {
        if (!ignore)
          setError(
            err instanceof Error ? err.message : "Failed to load subscription",
          );
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <CollapsibleCard title="Quick Access" contentClassName="space-y-5">
      {actions ? (
        <div className="border-b border-border pb-4">{actions}</div>
      ) : null}
      <section>
        <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" />
          Bill Due to UnitKo
        </h3>
        {loading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : error ? (
          <p className="py-2 text-sm text-destructive">{error}</p>
        ) : subscription ? (
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">{peso(subscription.price)}</p>
              <p className="text-xs text-muted-foreground">
                {subscription.planName} plan · {subscription.status}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">Next billing</p>
              <p className="text-sm font-medium">
                {formatDate(subscription.nextBillingAt)}
              </p>
            </div>
          </div>
        ) : null}
      </section>
      <ReminderActivity />
      <TenantResponses />
    </CollapsibleCard>
  );
}
