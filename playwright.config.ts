import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const fixture = (name: string): string =>
  fileURLToPath(new URL(`./tests/fixtures/generated/${name}`, import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  webServer: {
    command: "pnpm preview --host 127.0.0.1 --port 4321",
    url: "http://127.0.0.1:4321",
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://127.0.0.1:4321",
  },
  projects: [
    {
      name: "fake-mic-in-tune",
      testMatch: /tuner-live\.spec\.ts/,
      use: {
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            `--use-file-for-fake-audio-capture=${fixture("e2-in-tune.wav")}`,
            "--autoplay-policy=no-user-gesture-required",
          ],
        },
      },
    },
    {
      name: "fake-mic-flat",
      testMatch: /tuner-flat\.spec\.ts/,
      use: {
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            `--use-file-for-fake-audio-capture=${fixture("e2-flat.wav")}`,
            "--autoplay-policy=no-user-gesture-required",
          ],
        },
      },
    },
    {
      name: "no-mic",
      testMatch: /tuner-fallback\.spec\.ts/,
      use: {
        launchOptions: {
          // Without this, headless Chromium HANGS the permission prompt
          // rather than denying it — the tuner would wait forever.
          args: ["--deny-permission-prompts"],
        },
      },
    },
  ],
});
