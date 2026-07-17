"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShowMoreToggleProps {
  expanded: boolean;
  hiddenCount: number;
  onToggle: () => void;
}

// Pairs with useShowMore. Renders nothing once the list fits, so a caller can
// mount it unconditionally under any truncated feed.
export function ShowMoreToggle({
  expanded,
  hiddenCount,
  onToggle,
}: ShowMoreToggleProps) {
  if (hiddenCount === 0) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="mt-2 flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 transition-transform",
          !expanded && "-rotate-90",
        )}
      />
      {expanded ? "Show less" : `Show ${hiddenCount} more`}
    </button>
  );
}
