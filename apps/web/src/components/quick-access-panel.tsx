"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import type { Subscription } from "@unitko/shared";
import { fetchUserSubscription } from "@/services/subscriptionService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReminderActivity } from "@/components/reminder-activity";
import { peso, formatDate } from "@/lib/format";

// "One Look. One Click." — a consolidated dashboard panel. Sections land
// incrementally: first the landlord's own SaaS bill to UnitKo; the Zapier cycle
// and tenant-response sections follow.
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
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
                <p className="text-lg font-semibold">
                  {peso(subscription.price)}
                </p>
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
      </CardContent>
    </Card>
  );
}
