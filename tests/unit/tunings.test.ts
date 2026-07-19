import { describe, expect, it } from "vitest";
import {
  A4_HZ,
  centsBetween,
  midiToFreq,
  midiToNoteName,
  TUNINGS,
} from "@/lib/tunings";

describe("frequency derivation from A440", () => {
  it("derives A4 exactly", () => {
    expect(midiToFreq(69)).toBe(A4_HZ);
  });

  it("derives the standard guitar strings", () => {
    const expected: Record<string, number> = {
      E2: 82.41,
      A2: 110.0,
      D3: 146.83,
      G3: 196.0,
      B3: 246.94,
      E4: 329.63,
    };
    for (const s of TUNINGS.standard!.strings) {
      expect(s.freq).toBeCloseTo(expected[s.note]!, 1);
    }
  });

  it("names notes correctly", () => {
    expect(midiToNoteName(40)).toBe("E2");
    expect(midiToNoteName(69)).toBe("A4");
    expect(midiToNoteName(38)).toBe("D2");
  });

  it("centsBetween is zero at the target and ±100 at a semitone", () => {
    expect(centsBetween(440, 440)).toBeCloseTo(0);
    expect(centsBetween(midiToFreq(70), 440)).toBeCloseTo(100, 5);
    expect(centsBetween(midiToFreq(68), 440)).toBeCloseTo(-100, 5);
  });
});

describe("tuning definitions", () => {
  it("drop-d differs from standard only on the 6th string", () => {
    const std = TUNINGS.standard!.strings;
    const dropD = TUNINGS["drop-d"]!.strings;
    expect(dropD[0]!.note).toBe("D2");
    for (let i = 1; i < 6; i++) {
      expect(dropD[i]!.midi).toBe(std[i]!.midi);
    }
  });

  it("half-step-down is every standard string minus one semitone", () => {
    const std = TUNINGS.standard!.strings;
    const half = TUNINGS["half-step-down"]!.strings;
    for (let i = 0; i < 6; i++) {
      expect(half[i]!.midi).toBe(std[i]!.midi - 1);
    }
  });

  it("every tuning has six strings on a 3+3 peg layout", () => {
    for (const tuning of Object.values(TUNINGS)) {
      expect(tuning.strings).toHaveLength(6);
      const left = tuning.strings.filter((s) => s.peg.side === "left");
      const right = tuning.strings.filter((s) => s.peg.side === "right");
      expect(left).toHaveLength(3);
      expect(right).toHaveLength(3);
      expect(new Set(left.map((s) => s.peg.slot)).size).toBe(3);
      expect(new Set(right.map((s) => s.peg.slot)).size).toBe(3);
    }
  });
});
