/**
 * Tuning data model. Every frequency in the app derives from A4 — changing
 * the reference (future calibration UI) is a one-line change here.
 *
 * Only guitar-family tunings belong in this file: same 3+3 headstock
 * geometry, six strings, same UI. Other instruments (ukulele: 4 strings,
 * re-entrant, different headstock) need their own geometry and copy — see
 * the design doc's NOT-in-scope section.
 */

export const A4_HZ = 440;
const A4_MIDI = 69;

export const midiToFreq = (midi: number): number =>
  A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);

export const centsBetween = (freq: number, target: number): number =>
  1200 * Math.log2(freq / target);

const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

export const midiToNoteName = (midi: number): string =>
  `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

export interface TuningString {
  /** Display name, e.g. "E2" (low E). */
  note: string;
  midi: number;
  freq: number;
  /**
   * Peg position on a 3+3 right-handed headstock viewed from the front:
   * left column top→bottom = strings 6,5,4; right column top→bottom = 3,2,1.
   * (slot 2 = top, slot 0 = bottom, on both sides.)
   */
  peg: { side: "left" | "right"; slot: 0 | 1 | 2 };
}

export interface Tuning {
  slug: string;
  name: string;
  /** Strings ordered 6th (lowest) → 1st (highest). */
  strings: TuningString[];
}

/** Standard 3+3 peg layout for strings ordered 6th → 1st. */
const PEGS: TuningString["peg"][] = [
  { side: "left", slot: 2 }, // 6th (low) — top of the left column
  { side: "left", slot: 1 }, // 5th
  { side: "left", slot: 0 }, // 4th — bottom of the left column
  { side: "right", slot: 2 }, // 3rd — top of the right column
  { side: "right", slot: 1 }, // 2nd
  { side: "right", slot: 0 }, // 1st (high) — bottom of the right column
];

const makeTuning = (slug: string, name: string, midis: number[]): Tuning => ({
  slug,
  name,
  strings: midis.map((midi, i) => ({
    note: midiToNoteName(midi),
    midi,
    freq: midiToFreq(midi),
    peg: PEGS[i]!,
  })),
});

// MIDI numbers, strings 6th → 1st.
export const TUNINGS: Record<string, Tuning> = {
  standard: makeTuning("standard", "Standard (E A D G B E)", [40, 45, 50, 55, 59, 64]),
  "drop-d": makeTuning("drop-d", "Drop D (D A D G B E)", [38, 45, 50, 55, 59, 64]),
  "half-step-down": makeTuning(
    "half-step-down",
    "Half Step Down (E♭ A♭ D♭ G♭ B♭ E♭)",
    [39, 44, 49, 54, 58, 63],
  ),
  "drop-c": makeTuning("drop-c", "Drop C (C G C F A D)", [36, 43, 48, 53, 57, 62]),
  dadgad: makeTuning("dadgad", "DADGAD (D A D G A D)", [38, 45, 50, 55, 57, 62]),
  "open-g": makeTuning("open-g", "Open G (D G D G B D)", [38, 43, 50, 55, 59, 62]),
  "whole-step-down": makeTuning(
    "whole-step-down",
    "Whole Step Down (D G C F A D)",
    [38, 43, 48, 53, 57, 62],
  ),
};

/** Route for a tuning page: standard lives at the root. */
export const tuningPath = (slug: string): string =>
  slug === "standard" ? "/" : `/${slug}`;
