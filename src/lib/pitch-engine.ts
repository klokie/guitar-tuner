/**
 * Pitch engine: pitchy (McLeod Pitch Method) over raw sample buffers.
 * MPM outperforms YIN on low frequencies — low E (82.4 Hz) on a phone mic
 * is this app's hardest input. Pure functions; the audio source lives in
 * audio-input.ts so tests can feed synthetic and recorded buffers.
 */
import { PitchDetector } from "pitchy";
import { centsBetween, type Tuning, type TuningString } from "./tunings";

/** Below this MPM clarity a reading is noise, not a note. */
export const CLARITY_THRESHOLD = 0.9;

/**
 * Analysis window. 4096 samples ≈ 85ms at 48kHz — enough periods of an
 * 82 Hz fundamental for MPM to lock on. This window is why the honest
 * latency target is <250ms, not <100ms.
 */
export const WINDOW_SIZE = 4096;

export interface PitchReading {
  freq: number;
  clarity: number;
}

const detectors = new Map<number, PitchDetector<Float32Array>>();

/** Returns a confident pitch reading, or null for silence/noise. */
export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
): PitchReading | null {
  let detector = detectors.get(buffer.length);
  if (!detector) {
    detector = PitchDetector.forFloat32Array(buffer.length);
    detectors.set(buffer.length, detector);
  }
  const [freq, clarity] = detector.findPitch(buffer, sampleRate);
  if (!Number.isFinite(freq) || freq <= 0 || clarity < CLARITY_THRESHOLD) {
    return null;
  }
  return { freq, clarity };
}

/**
 * Auto-snap window. Adjacent guitar strings are 4–5 semitones apart, so ±2
 * can never claim a neighboring string — a harmonic misread outside the
 * window shows the detected note without string guidance instead of
 * confidently pointing at the wrong peg.
 */
export const SNAP_SEMITONES = 2;

export interface StringMatch {
  string: TuningString;
  /** Index within tuning.strings (0 = 6th/lowest). */
  index: number;
  cents: number;
}

/** Nearest target string within ±SNAP_SEMITONES, else null. */
export function nearestString(freq: number, tuning: Tuning): StringMatch | null {
  let best: StringMatch | null = null;
  for (let i = 0; i < tuning.strings.length; i++) {
    const s = tuning.strings[i]!;
    const cents = centsBetween(freq, s.freq);
    if (Math.abs(cents) > SNAP_SEMITONES * 100) continue;
    if (!best || Math.abs(cents) < Math.abs(best.cents)) {
      best = { string: s, index: i, cents };
    }
  }
  return best;
}

/**
 * Median-of-recent smoothing: kills single-frame harmonic flips without
 * adding perceptible lag at ~25 readings/sec.
 */
export class PitchSmoother {
  private readings: number[] = [];
  constructor(private readonly size = 5) {}

  add(freq: number): number {
    this.readings.push(freq);
    if (this.readings.length > this.size) this.readings.shift();
    const sorted = [...this.readings].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)]!;
  }

  reset(): void {
    this.readings = [];
  }
}
