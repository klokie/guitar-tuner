/**
 * Thin funnel → PostHog bridge. The theme's Analytics.astro loads posthog-js
 * (cookieless EU config, DNT/localhost no-op); this just forwards events and
 * stays silent when analytics is absent.
 */
import type { FunnelEvent } from "./stabilizer";

declare global {
  interface Window {
    posthog?: { capture: (name: string, props?: Record<string, unknown>) => void };
  }
}

export const capture = (event: FunnelEvent): void => {
  try {
    window.posthog?.capture(event.name, event.props);
  } catch {
    // Analytics must never break the tuner.
  }
};
