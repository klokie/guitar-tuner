import { klokie } from "@klokie/theme";
import type { ThemePreset } from "@klokie/theme/presets/types";

export const siteConfig = {
  title: "Guitar Tuner",
  tagline: "Tune your guitar in your browser — free, no app, no sign-up",
  description:
    "Free online guitar tuner with microphone. Tune your guitar in under two minutes — no app install, no account, works on any phone or laptop. Your audio never leaves your device.",
  url: import.meta.env.PUBLIC_SITE_URL ?? "https://tuner.klokie.com",
  monogram: "GT",
  copyrightName: "Guitar Tuner",
  locale: "en-US",
  preset: klokie as ThemePreset,
  nav: [
    { label: "Standard", href: "/" },
    { label: "Drop D", href: "/drop-d" },
    { label: "Half Step Down", href: "/half-step-down" },
  ],
  social: {} as Record<string, string>,
  analytics: {
    posthog: {
      key: import.meta.env.PUBLIC_POSTHOG_KEY as string | undefined,
      host:
        (import.meta.env.PUBLIC_POSTHOG_HOST as string | undefined) ??
        "https://eu.i.posthog.com",
    },
    sentry: {
      dsn: import.meta.env.PUBLIC_SENTRY_DSN as string | undefined,
      environment:
        (import.meta.env.PUBLIC_SENTRY_ENV as string | undefined) ??
        "production",
    },
  },
};

export type SiteConfig = typeof siteConfig;
