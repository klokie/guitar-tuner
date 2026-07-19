import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

const SITE = process.env.PUBLIC_SITE_URL ?? "https://tuner.klokie.com";

export default defineConfig({
  site: SITE,
  integrations: [sitemap()],
  output: "static",
  build: {
    format: "directory",
  },
  trailingSlash: "ignore",
  server: {
    // This Mac resolves localhost IPv6-first; default bind refuses 127.0.0.1.
    host: true,
  },
});
