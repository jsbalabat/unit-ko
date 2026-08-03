import { Fragment } from "react";
import {
  AlertCircle,
  Bell,
  Building,
  CreditCard,
  FileText,
  User,
} from "lucide-react";
import {
  formatValue,
  humanizeKey,
  isReferenceId,
  shortenId,
  visibleMetadataEntries,
} from "./activity-log-format";

// Icon by action family, shared by the activity page and the property History
// tab so the mapping can't drift between them. Order is significant: the more
// specific families (reminder, note) are matched before the broad tenant/property
// ones, since a code like `tenant_reminder_sent` or `property_note_added`
// contains both words.
export function ActionIcon({ actionType }: { actionType: string }) {
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

// The activity log's `metadata` document, disclosed as an expandable key/value
// list. Every log carries it and until now nothing rendered it. Empty or
// all-blank metadata renders nothing rather than a bare "Details" toggle.
export function ActivityMetadata({
  metadata,
}: {
  metadata: Record<string, unknown>;
}) {
  const entries = visibleMetadataEntries(metadata);
  if (entries.length === 0) return null;

  return (
    <details className="mt-1">
      <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
        Details
      </summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {entries.map(([key, value]) => (
          <Fragment key={key}>
            <dt className="text-muted-foreground">{humanizeKey(key)}</dt>
            <dd className="min-w-0 break-words font-medium">
              {isReferenceId(key) && typeof value === "string" ? (
                <span title={value} className="font-mono">
                  {shortenId(value)}
                </span>
              ) : (
                formatValue(value)
              )}
            </dd>
          </Fragment>
        ))}
      </dl>
    </details>
  );
}
