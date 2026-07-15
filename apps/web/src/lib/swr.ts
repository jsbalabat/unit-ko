import type { SWRConfiguration } from "swr";

// Shared revalidation policy for live-ish dashboard feeds. Focus + reconnect
// revalidation (SWR's defaults, stated here explicitly) surface cross-actor
// changes the moment a user returns to the tab; the interval is a visible-only
// safety net — SWR pauses it while the tab is hidden. Retune every feed at once
// by editing this one object.
export const liveFeedOptions: SWRConfiguration = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  refreshInterval: 45_000,
};
