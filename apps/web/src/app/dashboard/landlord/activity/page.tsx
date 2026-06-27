"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { withLandlordAuth } from "@/components/auth/withLandlordAuth";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity as ActivityIcon,
  AlertCircle,
  Bell,
  Building,
  CreditCard,
  FileText,
  Loader2,
  User,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { ActivityLog, PropertySummary } from "@unitko/shared";

// Icon by action family. Order is significant: the more specific families
// (reminder, note) are matched before the broad tenant/property ones, since a
// code like `tenant_reminder_sent` or `property_note_added` contains both words.
function actionIcon(actionType: string) {
  if (actionType.includes("payment"))
    return <CreditCard className="h-4 w-4 text-green-600" />;
  if (actionType.includes("reminder"))
    return <Bell className="h-4 w-4 text-amber-600" />;
  if (actionType.includes("note"))
    return <FileText className="h-4 w-4 text-slate-600" />;
  if (actionType.includes("tenant"))
    return <User className="h-4 w-4 text-blue-600" />;
  if (actionType.includes("property") || actionType.includes("billing"))
    return <Building className="h-4 w-4 text-purple-600" />;
  return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
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

const LIMITS = [50, 100, 200] as const;

function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [limit, setLimit] = useState<number>(50);

  // Pure fetch — the property + limit narrow server-side (the only filters the
  // API supports); action type is narrowed client-side below.
  const fetchLogs = useCallback(
    () =>
      api.activity.list({
        propertyId: propertyFilter === "all" ? undefined : propertyFilter,
        limit,
      }),
    [propertyFilter, limit],
  );

  const applyLogs = useCallback((rows: ActivityLog[]) => {
    setLogs(rows);
    setError(null);
  }, []);

  useEffect(() => {
    let ignore = false;
    fetchLogs()
      .then((rows) => {
        if (!ignore) applyLogs(rows);
      })
      .catch((err) => {
        if (!ignore)
          setError(
            err instanceof Error ? err.message : "Failed to load activity",
          );
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [fetchLogs, applyLogs]);

  // Property names for the filter dropdown; a failure just leaves it unpopulated
  // (the page still renders the unfiltered feed).
  useEffect(() => {
    let ignore = false;
    api.properties
      .list()
      .then((rows) => {
        if (!ignore) setProperties(rows);
      })
      .catch(() => {
        // Filter labels are non-essential; a failed load just leaves the
        // property dropdown empty while the feed still renders.
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Re-enter the loading state when a server-side filter changes — in render
  // rather than the effect, to avoid a synchronous setState inside it.
  const filterKey = `${propertyFilter}|${limit}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey);
    setLoading(true);
  }

  const propertyName = useCallback(
    (id: string | null) =>
      id ? (properties.find((p) => p.id === id)?.unitName ?? null) : null,
    [properties],
  );

  // Action-type options come from the codes actually present, labelled by the
  // human label the API already resolved — no second source of labels to drift.
  const actionOptions = useMemo(() => {
    const byCode = new Map<string, string>();
    for (const log of logs) {
      if (!byCode.has(log.actionType)) byCode.set(log.actionType, log.actionLabel);
    }
    return Array.from(byCode, ([code, label]) => ({ code, label }));
  }, [logs]);

  const visibleLogs = useMemo(
    () =>
      actionFilter === "all"
        ? logs
        : logs.filter((log) => log.actionType === actionFilter),
    [logs, actionFilter],
  );

  return (
    <>
      <SiteHeader />
      <main className="pb-12">
        <div className="container mx-auto px-4 md:px-6 py-6 max-w-4xl">
          <div className="flex items-center gap-2 mb-2">
            <ActivityIcon className="h-6 w-6" />
            <h1 className="text-2xl md:text-3xl font-bold">Activity Log</h1>
          </div>
          <p className="text-muted-foreground mb-6">
            A running history of changes across your properties.
          </p>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="All properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All properties</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.unitName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actionOptions.map((o) => (
                  <SelectItem key={o.code} value={o.code}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(limit)}
              onValueChange={(v) => setLimit(Number(v))}
            >
              <SelectTrigger className="sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIMITS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Last {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-lg animate-pulse">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="font-medium">Loading activity...</span>
              </div>
            </div>
          ) : visibleLogs.length === 0 ? (
            <div className="text-center py-12 px-4 border rounded-xl bg-muted/20">
              <ActivityIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">No activity yet</h3>
              <p className="text-muted-foreground">
                Changes you make will appear here as they happen.
              </p>
            </div>
          ) : (
            <Card className="shadow-sm">
              <CardContent className="p-4 md:p-6">
                <div className="space-y-1">
                  {visibleLogs.map((log) => {
                    const name = propertyName(log.propertyId);
                    return (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 py-3 border-b last:border-b-0"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            {actionIcon(log.actionType)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">
                              {log.description}
                            </p>
                            <Badge variant="secondary" className="text-[10px]">
                              {log.actionLabel}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDateTime(log.createdAt)}
                            {name ? ` · ${name}` : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}

export default withLandlordAuth(ActivityPage);
