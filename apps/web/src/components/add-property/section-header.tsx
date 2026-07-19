"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Right-aligned control for the section, e.g. an "Add entry" button. */
  action?: ReactNode;
}

/**
 * The heading for a card inside the wizard.
 *
 * Exists to hold one accent and one type scale. Each card used to pick its own
 * colour (blue / green / purple / orange) and its own heading size, which read
 * as five unrelated widgets rather than one form — the colour carried no
 * meaning, since nothing mapped a hue to a kind of content.
 */
export function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="shrink-0 rounded-md bg-primary/10 p-1.5">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
