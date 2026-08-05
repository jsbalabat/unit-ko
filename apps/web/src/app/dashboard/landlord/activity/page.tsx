"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { withLandlordAuth } from "@/components/auth/withLandlordAuth";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity as ActivityIcon, AlertCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { ActionIcon, ActivityMetadata } from "@/components/activity-log";
import { ACTIVITY_ACTION_TYPES } from "@unitko/shared";
import type { ActivityLog, PropertySummary } from "@unitko/shared";

// One keyset page. The feed accumulates page-by-page via "Load more"; a page
// shorter than this means there's nothing older left.
const PAGE_SIZE = 50;

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// Section header for a day bucket: Today / Yesterday / a full date.
function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const diffDays = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(date).getTime()) /
      86_400_000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// The feed arrives newest-first, so a day's entries are already contiguous —
// bucket them in order without re-sorting.
function groupByDay(
  logs: ActivityLog[],
): { label: string; logs: ActivityLog[] }[] {
  const groups: { label: string; logs: ActivityLog[] }[] = [];
  for (const log of logs) {
    const label = dayLabel(log.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.logs.push(log);
    else groups.push({ label, logs: [log] });
  }
  return groups;
}

function humanizeActionType(code: string): string {
  const spaced = code.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// The full action set for the filter, so it stays complete regardless of what the
// currently-loaded pages happen to contain. Feed rows still show the API's
// canonical label; this only labels the dropdown.
const ACTION_OPTIONS = ACTIVITY_ACTION_TYPES.map((code) => ({
  code,
  label: humanizeActionType(code),
}));

function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const filters = useMemo(
    () => ({
      propertyId: propertyFilter === "all" ? undefined : propertyFilter,
      actionType: actionFilter === "all" ? undefined : actionFilter,
    }),
    [propertyFilter, actionFilter],
  );

  // Re-enter the loading state when a filter changes — in render (React's "adjust
  // state on prop change") rather than inside the effect, to avoid a synchronous
  // setState in the effect body.
  const filterKey = `${propertyFilter}|${actionFilter}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey);
    setLoading(true);
  }

  // First keyset page for the current filters. Both filters narrow server-side, so
  // a change refetches from the top rather than filtering an already-loaded page.
  useEffect(() => {
    let ignore = false;
    api.activity
      .list({ ...filters, limit: PAGE_SIZE })
      .then((rows) => {
        if (ignore) return;
        setLogs(rows);
        setHasMore(rows.length === PAGE_SIZE);
        setError(null);
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
  }, [filters]);

  // Property names for the filter dropdown + row labels; a failure just leaves the
  // dropdown empty while the feed still renders.
  useEffect(() => {
    let ignore = false;
    api.properties
      .list()
      .then((rows) => {
        if (!ignore) setProperties(rows);
      })
      .catch(() => {
        // Filter labels are non-essential.
      });
    return () => {
      ignore = true;
    };
  }, []);

  const loadMore = useCallback(() => {
    const cursor = logs[logs.length - 1];
    if (!cursor) return;
    setLoadingMore(true);
    api.activity
      .list({
        ...filters,
        before: cursor.createdAt,
        beforeId: cursor.id,
        limit: PAGE_SIZE,
      })
      .then((rows) => {
        setLogs((prev) => [...prev, ...rows]);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load more"),
      )
      .finally(() => setLoadingMore(false));
  }, [logs, filters]);

  const propertyName = useCallback(
    (id: string | null) =>
      id ? (properties.find((p) => p.id === id)?.unitName ?? null) : null,
    [properties],
  );

  const groups = useMemo(() => groupByDay(logs), [logs]);

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

          {/* Filters — both narrow server-side */}
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
                {ACTION_OPTIONS.map((o) => (
                  <SelectItem key={o.code} value={o.code}>
                    {o.label}
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
          ) : logs.length === 0 ? (
            <div className="text-center py-12 px-4 border rounded-xl bg-muted/20">
              <ActivityIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">No activity yet</h3>
              <p className="text-muted-foreground">
                Changes you make will appear here as they happen.
              </p>
            </div>
          ) : (
            <>
              <Card className="shadow-sm">
                <CardContent className="p-4 md:p-6 space-y-4">
                  {groups.map((group) => (
                    <details key={group.label} open className="group">
                      <summary className="flex items-center justify-between cursor-pointer select-none list-none py-1.5 border-b">
                        <span className="text-sm font-semibold">
                          {group.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {group.logs.length}
                          {group.logs.length === 1 ? " entry" : " entries"}
                        </span>
                      </summary>
                      <div className="mt-1">
                        {group.logs.map((log) => {
                          const name = propertyName(log.propertyId);
                          return (
                            <div
                              key={log.id}
                              className="flex items-start gap-3 py-3 border-b last:border-b-0"
                            >
                              <div className="flex-shrink-0 mt-0.5">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <ActionIcon actionType={log.actionType} />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium">
                                    {log.description}
                                  </p>
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px]"
                                  >
                                    {log.actionLabel}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatTime(log.createdAt)}
                                  {name ? ` · ${name}` : ""}
                                </p>
                                <ActivityMetadata metadata={log.metadata} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  ))}
                </CardContent>
              </Card>

              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load more"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

export default withLandlordAuth(ActivityPage);
