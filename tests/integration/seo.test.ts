/** SEO baseline checks against the built site. Run `pnpm build` first. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const DIST = join(__dirname, "..", "..", "dist");
const SITE = process.env.PUBLIC_SITE_URL ?? "https://tuner.klokie.com";

const ROUTES = [
  { dir: "", path: "/" },
  { dir: "drop-d", path: "/drop-d/" },
  { dir: "half-step-down", path: "/half-step-down/" },
];

const html = (dir: string): string =>
  readFileSync(join(DIST, dir, "index.html"), "utf8");

beforeAll(() => {
  if (!existsSync(DIST)) {
    throw new Error("dist/ missing — run `pnpm build` before test:seo");
  }
});

describe.each(ROUTES)("route $path", ({ dir, path }) => {
  it("has a self-referencing canonical on the canonical host", () => {
    expect(html(dir)).toContain(
      `<link rel="canonical" href="${new URL(path, SITE).href}"`,
    );
  });

  it("has OG + Twitter baseline", () => {
    const page = html(dir);
    expect(page).toContain('property="og:title"');
    expect(page).toContain('property="og:description"');
    expect(page).toContain('property="og:type" content="website"');
    expect(page).toContain('property="og:url"');
    expect(page).toContain('property="og:image"');
    expect(page).toContain('name="twitter:card" content="summary_large_image"');
  });

  it("has WebApplication JSON-LD", () => {
    const page = html(dir);
    const match = page.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    );
    expect(match).not.toBeNull();
    const parsed = JSON.parse(
      match![1]!
        .replace(/\\u003c/g, "<")
        .replace(/\\u003e/g, ">")
        .replace(/\\u0026/g, "&"),
    );
    expect(parsed["@type"]).toBe("WebApplication");
    expect(parsed.offers?.price).toBe("0");
    expect(parsed.url).toBe(new URL(path, SITE).href);
  });

  it("has a unique title and meta description", () => {
    const page = html(dir);
    expect(page).toMatch(/<title>[^<]{10,}<\/title>/);
    expect(page).toContain('name="description"');
  });
});

describe("site plumbing", () => {
  it("robots.txt exists and points at the sitemap on the canonical host", () => {
    const robots = readFileSync(join(DIST, "robots.txt"), "utf8");
    expect(robots).toContain(`Sitemap: ${new URL("/sitemap-index.xml", SITE).href}`);
  });

  it("sitemap exists and lists all three tuner routes", () => {
    expect(existsSync(join(DIST, "sitemap-index.xml"))).toBe(true);
    const sitemap = readFileSync(join(DIST, "sitemap-0.xml"), "utf8");
    for (const { path } of ROUTES) {
      expect(sitemap).toContain(new URL(path, SITE).href);
    }
  });

  it("404 page is built", () => {
    expect(existsSync(join(DIST, "404.html"))).toBe(true);
  });

  it("titles are unique across routes", () => {
    const titles = ROUTES.map(({ dir }) => html(dir).match(/<title>([^<]+)<\/title>/)?.[1]);
    expect(new Set(titles).size).toBe(ROUTES.length);
  });
});
