/**
 * Per-string stabilization state machine + session funnel.
 *
 * Per string:  idle → detecting → stabilizing → done ✓
 *                       │  in-tune reading        │ wobble > IN_TUNE_CENTS
 *                       ▼  (|cents| ≤ 5)          │ resets the hold timer
 *                    stabilizing ─── 1.5s held ──► done
 *
 * Funnel events (design doc definitions — the success gate depends on these):
 *   signal_detected   — confident reading sustained ≥ 300ms (once/session)
 *   string_stabilized — |cents| ≤ 5 held 1.5s (once per string)
 *   tuning_completed  — every string done, at most once per session
 * Fallback sessions are tagged and excluded from funnel denominators.
 */
import type { Tuning } from "./tunings";

export const IN_TUNE_CENTS = 5;
export const HOLD_MS = 1500;
export const SIGNAL_MS = 300;

export type StringState = "idle" | "detecting" | "stabilizing" | "done";

export interface FunnelEvent {
  name:
    | "mic_granted"
    | "signal_detected"
    | "string_stabilized"
    | "tuning_completed"
    | "fallback_mode";
  props?: Record<string, unknown>;
}

type Emit = (event: FunnelEvent) => void;

export class TuningSession {
  readonly states: StringState[];
  private signalStart: number | null = null;
  private signalFired = false;
  private signalDetectedAt: number | null = null;
  private holdStart: number | null = null;
  private activeIndex: number | null = null;
  private completedFired = false;
  private fallback = false;

  constructor(
    private readonly tuning: Tuning,
    private readonly emit: Emit,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.states = tuning.strings.map(() => "idle");
  }

  micGranted(): void {
    this.emit({ name: "mic_granted", props: { tuning: this.tuning.slug } });
  }

  enterFallback(reason: string): void {
    if (this.fallback) return;
    this.fallback = true;
    this.emit({ name: "fallback_mode", props: { reason, tuning: this.tuning.slug } });
  }

  get isFallback(): boolean {
    return this.fallback;
  }

  /**
   * Feed one engine tick. `stringIndex` is the matched string (auto-snap or
   * manual selection), or null when there's no confident reading.
   */
  update(stringIndex: number | null, cents: number | null): void {
    const t = this.now();

    if (stringIndex === null || cents === null) {
      this.signalStart = null;
      this.holdStart = null;
      if (this.activeIndex !== null && this.states[this.activeIndex] === "stabilizing") {
        this.states[this.activeIndex] = "detecting";
      }
      return;
    }

    if (!this.signalFired && !this.fallback) {
      if (this.signalStart === null) this.signalStart = t;
      if (t - this.signalStart >= SIGNAL_MS) {
        this.signalFired = true;
        this.signalDetectedAt = t;
        this.emit({ name: "signal_detected", props: { tuning: this.tuning.slug } });
      }
    }

    if (this.activeIndex !== stringIndex) {
      if (this.activeIndex !== null && this.states[this.activeIndex] === "stabilizing") {
        this.states[this.activeIndex] = "detecting";
      }
      this.activeIndex = stringIndex;
      this.holdStart = null;
    }

    if (this.states[stringIndex] === "done") return;

    if (Math.abs(cents) <= IN_TUNE_CENTS) {
      this.states[stringIndex] = "stabilizing";
      if (this.holdStart === null) this.holdStart = t;
      if (t - this.holdStart >= HOLD_MS) {
        this.states[stringIndex] = "done";
        this.holdStart = null;
        if (!this.fallback) {
          this.emit({
            name: "string_stabilized",
            props: {
              tuning: this.tuning.slug,
              string: this.tuning.strings[stringIndex]!.note,
              since_signal_ms:
                this.signalDetectedAt !== null ? Math.round(t - this.signalDetectedAt) : null,
            },
          });
        }
        this.maybeComplete(t);
      }
    } else {
      this.states[stringIndex] = "detecting";
      this.holdStart = null;
    }
  }

  private maybeComplete(t: number): void {
    if (this.completedFired || this.fallback) return;
    if (this.states.every((s) => s === "done")) {
      this.completedFired = true;
      this.emit({
        name: "tuning_completed",
        props: {
          tuning: this.tuning.slug,
          since_signal_ms:
            this.signalDetectedAt !== null ? Math.round(t - this.signalDetectedAt) : null,
        },
      });
    }
  }
}
