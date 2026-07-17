"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CollapsibleCardProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

// A Card the user can fold away. Collapsing unmounts the body rather than hiding
// it with CSS, so the SWR feeds inside stop polling while they're out of sight —
// a folded panel shouldn't cost requests. Their cache survives, so re-opening
// paints immediately and revalidates in the background.
export function CollapsibleCard({
  title,
  description,
  children,
  className,
  contentClassName,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(true);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              {title}
            </CardTitle>
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <span className="sr-only">
              {open ? `Collapse ${title}` : `Expand ${title}`}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                !open && "-rotate-90",
              )}
            />
          </button>
        </div>
      </CardHeader>
      {open ? (
        <CardContent className={contentClassName}>{children}</CardContent>
      ) : null}
    </Card>
  );
}
