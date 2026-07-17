"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  icon: ReactNode;
  /** Items still waiting on the landlord. Shown in the header so a collapsed
   * section still says whether it's worth opening. */
  queuedCount?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

// A foldable section inside a panel. Unlike CollapsibleCard, this hides only the
// body and leaves the caller's data hook mounted — the header's queued count is
// derived from that data, so unmounting on collapse would zero out the very
// number the collapsed state exists to show.
export function CollapsibleSection({
  title,
  icon,
  queuedCount = 0,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      <h3>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              !open && "-rotate-90",
            )}
          />
          {icon}
          {title}
          {queuedCount > 0 ? (
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {queuedCount}
            </span>
          ) : null}
        </button>
      </h3>
      {open ? <div className="mt-2">{children}</div> : null}
    </section>
  );
}
