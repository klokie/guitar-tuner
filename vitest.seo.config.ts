import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Runs against dist/ — `pnpm build` first.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
  },
});
