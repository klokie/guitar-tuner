/**
 * Tuner island controller. Wires DOM ← engine ← mic.
 *
 * start ─► env check ──ok──► openMic ──► poll ~25×/s ──► detect ──► update UI
 *              │ fail                        │ error
 *              ▼                             ▼
 *          fallback panel (reference tones, degraded mode)
 */
import { detectEnvironment, openMic, type MicSession } from "@/lib/audio-input";
import {
  detectPitch,
  nearestString,
  PitchSmoother,
  WINDOW_SIZE,
} from "@/lib/pitch-engine";
import { playReferenceTone } from "@/lib/reference-tones";
import { TuningSession } from "@/lib/stabilizer";
import { capture } from "@/lib/analytics";
import { TUNINGS, centsBetween, type Tuning } from "@/lib/tunings";

const POLL_MS = 40; // ~25 analyses/sec — fast enough to feel live, kind to batteries.
const QUIET_HINT_MS = 10_000;

export function initTuner(root: HTMLElement): void {
  const tuning: Tuning = TUNINGS[root.dataset.tuning ?? "standard"] ?? TUNINGS.standard!;
  const session = new TuningSession(tuning, capture);

  const el = <T extends HTMLElement>(sel: string): T => {
    const node = root.querySelector<T>(sel);
    if (!node) throw new Error(`tuner: missing ${sel}`);
    return node;
  };

  const startPanel = el("[data-tuner-start-panel]");
  const startButton = el<HTMLButtonElement>("[data-tuner-start]");
  const livePanel = el("[data-tuner-live]");
  const fallbackPanel = el("[data-tuner-fallback]");
  const fallbackReason = el("[data-tuner-fallback-reason]");
  const noteEl = el("[data-tuner-note]");
  const centsEl = el("[data-tuner-cents]");
  const needleEl = el("[data-tuner-needle]");
  const statusEl = el("[data-tuner-status]");
  const levelEl = el("[data-tuner-level]");
  const stringButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-tuner-string]"),
  );
  const autoButton = el<HTMLButtonElement>("[data-tuner-auto]");
  const pegs = Array.from(root.querySelectorAll<SVGElement & HTMLElement>("[data-peg]"));

  let mic: MicSession | null = null;
  let timer: number | null = null;
  let manualIndex: number | null = null;
  let lastSignalAt = performance.now();
  const smoother = new PitchSmoother();
  const buffer = new Float32Array(WINDOW_SIZE);

  const showFallback = (
    reason: "webview" | "insecure" | "denied" | "unsupported" | "failed",
  ): void => {
    session.enterFallback(reason);
    startPanel.hidden = true;
    livePanel.hidden = true;
    fallbackPanel.hidden = false;
    fallbackReason.textContent =
      reason === "webview"
        ? "This in-app browser blocks microphone access. Open this page in your regular browser (Safari or Chrome) for live tuning — or tune by ear below."
        : reason === "insecure"
          ? "Live tuning needs a secure connection, and this page was opened over plain HTTP. Open https://tuner.klokie.com for the live tuner — or tune by ear below."
          : reason === "denied"
            ? "Microphone access was denied. You can still tune by ear: play each string's reference note and match it."
            : "Live tuning isn't available in this browser. Play each string's reference note and match it by ear.";
  };

  const setActiveString = (index: number | null): void => {
    pegs.forEach((peg, i) => peg.classList.toggle("peg--active", i === index));
    stringButtons.forEach((btn, i) =>
      btn.classList.toggle("string--active", i === index),
    );
  };

  const renderStates = (): void => {
    stringButtons.forEach((btn, i) => {
      btn.classList.toggle("string--done", session.states[i] === "done");
    });
    pegs.forEach((peg, i) => {
      peg.classList.toggle("peg--done", session.states[i] === "done");
    });
  };

  const tick = (): void => {
    if (!mic) return;
    mic.analyser.getFloatTimeDomainData(buffer);

    let peak = 0;
    for (let i = 0; i < buffer.length; i += 16) {
      const v = Math.abs(buffer[i]!);
      if (v > peak) peak = v;
    }
    levelEl.style.setProperty("--level", String(Math.min(1, peak * 3)));

    const reading = detectPitch(buffer, mic.context.sampleRate);
    if (!reading) {
      session.update(null, null);
      if (performance.now() - lastSignalAt > QUIET_HINT_MS) {
        statusEl.textContent =
          "Can't hear a string. Move closer to the microphone and pluck one string at a time.";
      }
      root.classList.remove("tuner--in-tune");
      return;
    }
    lastSignalAt = performance.now();

    const freq = smoother.add(reading.freq);
    let index: number | null;
    let cents: number | null;

    if (manualIndex !== null) {
      index = manualIndex;
      cents = centsBetween(freq, tuning.strings[manualIndex]!.freq);
    } else {
      const match = nearestString(freq, tuning);
      index = match?.index ?? null;
      cents = match?.cents ?? null;
    }

    if (index === null || cents === null) {
      // Outside the snap window: show what we hear, claim nothing.
      noteEl.textContent = `${freq.toFixed(1)} Hz`;
      centsEl.textContent = "";
      statusEl.textContent = "Pluck one string near the microphone, or tap a string below.";
      needleEl.style.setProperty("--cents", "0");
      setActiveString(null);
      root.classList.remove("tuner--in-tune");
      session.update(null, null);
      return;
    }

    const s = tuning.strings[index]!;
    const clamped = Math.max(-50, Math.min(50, cents));
    noteEl.textContent = s.note;
    centsEl.textContent = `${cents > 0 ? "+" : ""}${cents.toFixed(0)}¢`;
    needleEl.style.setProperty("--cents", clamped.toFixed(1));
    statusEl.textContent =
      Math.abs(cents) <= 5
        ? "In tune — hold it steady…"
        : cents < 0
          ? "Too low — tighten this string's peg slowly until the needle centers."
          : "Too high — loosen this string's peg slowly until the needle centers.";
    root.classList.toggle("tuner--in-tune", Math.abs(cents) <= 5);
    setActiveString(index);
    session.update(index, cents);
    renderStates();
  };

  startButton.addEventListener("click", async () => {
    const env = detectEnvironment();
    if (!env.ok) {
      showFallback(
        env.reason === "webview"
          ? "webview"
          : env.reason === "insecure-context"
            ? "insecure"
            : "unsupported",
      );
      return;
    }
    startButton.disabled = true;
    startButton.textContent = "Starting microphone…";
    try {
      mic = await openMic(WINDOW_SIZE);
    } catch {
      showFallback("denied");
      return;
    }
    session.micGranted();
    startPanel.hidden = true;
    livePanel.hidden = false;
    lastSignalAt = performance.now();
    timer = window.setInterval(tick, POLL_MS);
  });

  stringButtons.forEach((btn, i) => {
    btn.addEventListener("click", () => {
      manualIndex = i;
      smoother.reset();
      autoButton.classList.remove("string--active-mode");
      setActiveString(i);
      if (session.isFallback) {
        playReferenceTone(tuning.strings[i]!.freq);
      }
    });
  });

  autoButton.addEventListener("click", () => {
    manualIndex = null;
    smoother.reset();
    autoButton.classList.add("string--active-mode");
  });

  root.querySelectorAll<HTMLButtonElement>("[data-tuner-tone]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const freq = Number(btn.dataset.tunerTone);
      if (Number.isFinite(freq)) playReferenceTone(freq);
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (!timer) return;
    if (document.hidden) {
      window.clearInterval(timer);
      timer = null;
    } else if (mic) {
      timer = window.setInterval(tick, POLL_MS);
    }
  });

  window.addEventListener("pagehide", () => {
    if (timer) window.clearInterval(timer);
    mic?.stop();
  });
}
