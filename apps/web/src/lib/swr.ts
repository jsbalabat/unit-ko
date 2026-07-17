import type { SWRConfiguration } from "swr";

// Shared revalidation policy for live-ish dashboard feeds. Focus + reconnect
// revalidation (SWR's defaults, stated here explicitly) surface cross-actor
// changes the moment a user returns to the tab; the interval only covers the
// narrower case of a screen being watched passively — SWR pauses it while the
// tab is hidden. Retune every feed at once by editing this one object.
//
// 15s is a floor, not a dial to keep turning: tenants read this on phones, and
// polling faster than a cellular radio's idle tail (~5-15s) pins it awake for
// the whole session. If this ever feels slow, the fix is event-driven delivery
// or cheap 304 polls — not a smaller number here.
export const liveFeedOptions: SWRConfiguration = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  refreshInterval: 15_000,
};
