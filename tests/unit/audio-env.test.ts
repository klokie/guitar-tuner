import { describe, expect, it } from "vitest";
import { detectEnvironment } from "@/lib/audio-input";

const mkNav = (ua: string, gum = true): Navigator =>
  ({
    userAgent: ua,
    mediaDevices: gum ? { getUserMedia: () => Promise.resolve({} as MediaStream) } : undefined,
  }) as unknown as Navigator;

const mkWin = (audio = true, secure = true): Window =>
  ({
    ...(audio ? { AudioContext: class {} } : {}),
    isSecureContext: secure,
  }) as unknown as Window;

const CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36";

describe("detectEnvironment", () => {
  it("passes a normal mobile Chrome", () => {
    expect(detectEnvironment(mkNav(CHROME_UA), mkWin())).toEqual({ ok: true });
  });

  it("flags the Instagram in-app browser", () => {
    const ua = `${CHROME_UA} Instagram 300.0.0.0`;
    expect(detectEnvironment(mkNav(ua), mkWin())).toEqual({
      ok: false,
      reason: "webview",
    });
  });

  it("flags the Google app (GSA) webview", () => {
    const ua = `${CHROME_UA} GSA/16.0`;
    expect(detectEnvironment(mkNav(ua), mkWin())).toEqual({
      ok: false,
      reason: "webview",
    });
  });

  it("flags an insecure (plain-HTTP) context before blaming the browser", () => {
    // LAN dev over http://192.168.x.x: browsers hide mediaDevices by policy.
    expect(detectEnvironment(mkNav(CHROME_UA, false), mkWin(true, false))).toEqual({
      ok: false,
      reason: "insecure-context",
    });
  });

  it("flags missing getUserMedia", () => {
    expect(detectEnvironment(mkNav(CHROME_UA, false), mkWin())).toEqual({
      ok: false,
      reason: "no-getusermedia",
    });
  });

  it("flags missing AudioContext", () => {
    expect(detectEnvironment(mkNav(CHROME_UA), mkWin(false))).toEqual({
      ok: false,
      reason: "no-audiocontext",
    });
  });
});
