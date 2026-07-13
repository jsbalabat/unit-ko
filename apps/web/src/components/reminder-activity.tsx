"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import type { ReminderLog } from "@unitko/shared";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";

const STATUS_STYLE: Record<
  ReminderLog["status"],
  { label: string; dot: string; text: string }
> = {
  sent: {
    label: "Sent",
    dot: "bg-green-500",
    text: "text-green-700 dark:text-green-400",
  },
  failed: {
    label: "Failed",
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
  },
  pending: {
    label: "Pending",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
  },
};

// The reminder-cycle feed: the most recent rent reminders and how each one
// actually settled (sent / failed / pending), resolved to tenant + property.
export function ReminderActivity() {
  const [logs, setLogs] = useState<ReminderLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    api.reminders
      .recent(8)
      .then((rows) => {
        if (!ignore) setLogs(rows);
      })
      .catch((err) => {
        if (!ignore)
          setError(
            err instanceof Error ? err.message : "Failed to load reminders",
          );
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section>
      <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
        <BellRing className="h-3.5 w-3.5" />
        Reminder Activity
      </h3>
      {error ? (
        <p className="py-2 text-sm text-destructive">{error}</p>
      ) : logs === null ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : logs.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          No reminders sent yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => {
            const style = STATUS_STYLE[log.status];
            return (
              <li
                key={log.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {log.tenantName ?? "Unknown tenant"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {log.propertyName ?? "—"} · {formatDateTime(log.createdAt)}
                  </p>
                </div>
                <span
                  className={`flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${style.text}`}
                  title={log.error ?? undefined}
                >
                  <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                  {style.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
