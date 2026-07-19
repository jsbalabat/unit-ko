"use client";

import type { ReactNode } from "react";

/**
 * The one-line "what you're doing and to which property" strip above a step.
 *
 * Each step used to render its own version in its own colour, which made the
 * same piece of information look like three different kinds of message. Muted
 * on purpose: it's orientation, not an alert, and the coloured variants were
 * competing with the fields for attention.
 */
export function StepBanner({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border bg-muted/40 px-3 py-2 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
