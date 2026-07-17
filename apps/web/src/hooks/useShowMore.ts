"use client";

import { useState } from "react";

interface ShowMore<T> {
  visible: T[];
  hiddenCount: number;
  expanded: boolean;
  toggle: () => void;
}

// Caps a feed at `limit` rows until the user asks for the rest. hiddenCount is 0
// when the list already fits, which is what lets callers mount the toggle
// unconditionally instead of repeating the length check at every call site.
export function useShowMore<T>(items: T[], limit: number): ShowMore<T> {
  const [expanded, setExpanded] = useState(false);

  return {
    visible: expanded ? items : items.slice(0, limit),
    hiddenCount: Math.max(0, items.length - limit),
    expanded,
    toggle: () => setExpanded((prev) => !prev),
  };
}
