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

  it("drop-c is whole-step-down with the 6th dropped one more step", () => {
    const whole = TUNINGS["whole-step-down"]!.strings;
    const dropC = TUNINGS["drop-c"]!.strings;
    expect(dropC[0]!.midi).toBe(whole[0]!.midi - 2);
    for (let i = 1; i < 6; i++) {
      expect(dropC[i]!.midi).toBe(whole[i]!.midi);
    }
    expect(dropC[0]!.note).toBe("C2");
  });

  it("dadgad changes exactly strings 6, 2, 1 from standard (each −2)", () => {
    const std = TUNINGS.standard!.strings;
    const dadgad = TUNINGS.dadgad!.strings;
    const changed = [0, 4, 5];
    for (let i = 0; i < 6; i++) {
      const delta = changed.includes(i) ? -2 : 0;
      expect(dadgad[i]!.midi).toBe(std[i]!.midi + delta);
    }
    expect(dadgad.map((s) => s.note.replace(/\d+$/, "")).join("")).toBe("DADGAD");
  });

  it("open-g open strings spell a G major chord", () => {
    const notes = TUNINGS["open-g"]!.strings.map((s) => s.note.replace(/\d+$/, ""));
    expect(notes).toEqual(["D", "G", "D", "G", "B", "D"]);
  });

  it("whole-step-down is every standard string minus two semitones", () => {
    const std = TUNINGS.standard!.strings;
    const whole = TUNINGS["whole-step-down"]!.strings;
    for (let i = 0; i < 6; i++) {
      expect(whole[i]!.midi).toBe(std[i]!.midi - 2);
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

  it("places the 6th string (low) at the top of the left column, 4th at the bottom", () => {
    // Regression: strings 6 and 4 were swapped (low E at the bottom, D at
    // the top) until a user with a real guitar caught it.
    const [s6, s5, s4] = TUNINGS.standard!.strings;
    expect(s6!.peg).toEqual({ side: "left", slot: 2 }); // top
    expect(s5!.peg).toEqual({ side: "left", slot: 1 }); // middle
    expect(s4!.peg).toEqual({ side: "left", slot: 0 }); // bottom
  });

  it("places the 3rd string at the top of the right column, 1st at the bottom", () => {
    const strings = TUNINGS.standard!.strings;
    const [s3, s2, s1] = [strings[3]!, strings[4]!, strings[5]!];
    expect(s3.peg).toEqual({ side: "right", slot: 2 }); // top
    expect(s2.peg).toEqual({ side: "right", slot: 1 }); // middle
    expect(s1.peg).toEqual({ side: "right", slot: 0 }); // bottom
  });
});
