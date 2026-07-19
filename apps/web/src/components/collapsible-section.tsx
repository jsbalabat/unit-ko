"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  icon: ReactNode;
  /** Items worth surfacing while collapsed, so the header still says whether
   * the section is worth opening. What it counts is the caller's call. */
  badgeCount?: number;
  /** "alert" for counts that mean something went wrong, so a broken count
   * doesn't read the same as a merely-waiting one. */
  tone?: "default" | "alert";
  defaultOpen?: boolean;
  children: ReactNode;
}

// A foldable section inside a panel. Unlike CollapsibleCard, this hides only the
// body and leaves the caller's data hook mounted — the header's badge count is
// derived from that data, so unmounting on collapse would zero out the very
// number the collapsed state exists to show.
export function CollapsibleSection({
  title,
  icon,
  badgeCount = 0,
  tone = "default",
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
          {badgeCount > 0 ? (
            <span
              className={cn(
                "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold",
                tone === "alert"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary",
              )}
            >
              {badgeCount}
            </span>
          ) : null}
        </button>
      </h3>
      {open ? <div className="mt-2">{children}</div> : null}
    </section>
  );
}
