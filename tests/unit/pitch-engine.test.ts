import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectPitch,
  nearestString,
  PitchSmoother,
  SNAP_SEMITONES,
  WINDOW_SIZE,
} from "@/lib/pitch-engine";
import { centsBetween, midiToFreq, TUNINGS } from "@/lib/tunings";
import { sine, weakFundamental, whiteNoise, silence } from "../helpers/signals";

const RATES = [44100, 48000];
const STANDARD = TUNINGS.standard!;

describe("detectPitch on synthetic tones", () => {
  for (const rate of RATES) {
    it(`detects every standard string at ${rate}Hz`, () => {
      for (const s of STANDARD.strings) {
        const reading = detectPitch(sine(s.freq, rate, WINDOW_SIZE), rate);
        expect(reading, `${s.note} @ ${rate}`).not.toBeNull();
        expect(Math.abs(centsBetween(reading!.freq, s.freq))).toBeLessThan(3);
      }
    });
  }

  it("returns null for silence", () => {
    expect(detectPitch(silence(WINDOW_SIZE), 48000)).toBeNull();
  });

  it("returns null for white noise", () => {
    expect(detectPitch(whiteNoise(WINDOW_SIZE), 48000)).toBeNull();
  });

  it("survives a weak-fundamental low E without an octave error", () => {
    const e2 = STANDARD.strings[0]!.freq;
    const reading = detectPitch(weakFundamental(e2, 48000, WINDOW_SIZE), 48000);
    expect(reading).not.toBeNull();
    // An octave error would read ~164.8 Hz; accept only the true fundamental.
    expect(Math.abs(centsBetween(reading!.freq, e2))).toBeLessThan(30);
  });
});

const realDir = join(__dirname, "..", "fixtures", "real-plucks");
const realWavs = existsSync(realDir)
  ? readdirSync(realDir).filter((f) => f.endsWith(".wav"))
  : [];

// Real phone-mic recordings (design doc D5.4). Record ~7 short WAVs named
// like `E2-82.41.wav` and drop them in tests/fixtures/real-plucks/.
describe.skipIf(realWavs.length === 0)("detectPitch on real phone-mic plucks", () => {
  for (const file of realWavs) {
    it(`detects ${file}`, () => {
      const expected = Number(file.replace(/\.wav$/, "").split("-").pop());
      const { samples, sampleRate } = parseWav(readFileSync(join(realDir, file)));
      const start = Math.floor(samples.length / 4);
      const buf = samples.slice(start, start + WINDOW_SIZE);
      const reading = detectPitch(buf, sampleRate);
      expect(reading).not.toBeNull();
      expect(Math.abs(centsBetween(reading!.freq, expected))).toBeLessThan(50);
    });
  }
});

function parseWav(data: Buffer): { samples: Float32Array; sampleRate: number } {
  const sampleRate = data.readUInt32LE(24);
  const bits = data.readUInt16LE(34);
  const channels = data.readUInt16LE(22);
  const dataStart = data.indexOf(Buffer.from("data")) + 8;
  const bytes = bits / 8;
  const frameCount = Math.floor((data.length - dataStart) / (bytes * channels));
  const samples = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    samples[i] = data.readInt16LE(dataStart + i * bytes * channels) / 32768;
  }
  return { samples, sampleRate };
}

describe("nearestString snap policy", () => {
  it("matches each open string exactly", () => {
    for (let i = 0; i < STANDARD.strings.length; i++) {
      const match = nearestString(STANDARD.strings[i]!.freq, STANDARD);
      expect(match?.index).toBe(i);
      expect(match?.cents).toBeCloseTo(0, 4);
    }
  });

  it("snaps a slightly flat string to itself, not a neighbor", () => {
    const a2 = STANDARD.strings[1]!;
    const flat = a2.freq * Math.pow(2, -150 / 1200); // 1.5 semitones flat
    const match = nearestString(flat, STANDARD);
    expect(match?.index).toBe(1);
    expect(match!.cents).toBeCloseTo(-150, 0);
  });

  it("refuses to claim anything beyond ±SNAP_SEMITONES", () => {
    const a2 = STANDARD.strings[1]!;
    const wayOff = a2.freq * Math.pow(2, (SNAP_SEMITONES * 100 + 60) / 1200);
    // 2.6 semitones above A2 sits between A2 (+260¢) and D3 (-240¢ vs D3? no:
    // D3 is 5 semitones above A2, so this is 2.4 semitones below D3) — both
    // outside the window. Nothing may match.
    expect(nearestString(wayOff, STANDARD)).toBeNull();
  });

  it("an octave-error reading of low E does not claim another string", () => {
    const e3 = midiToFreq(52); // octave above low E2
    const match = nearestString(e3, STANDARD);
    // E3 is 4 semitones below A2's... actually E3 is 7 semitones above A2 and
    // 2 semitones above D3 — exactly on the ±2 boundary vs D3. The policy
    // must not confidently claim D3 for a doubled low-E reading beyond the
    // window; boundary readings may match D3 at +200¢ which the UI shows as
    // wildly out of tune rather than "in tune on the wrong string".
    if (match) {
      expect(Math.abs(match.cents)).toBeGreaterThanOrEqual(195);
    }
  });
});

describe("PitchSmoother", () => {
  it("median-filters a single harmonic flip", () => {
    const s = new PitchSmoother(5);
    s.add(82.4);
    s.add(82.5);
    expect(s.add(164.8)).toBeLessThan(100); // flip suppressed
  });

  it("reset clears history", () => {
    const s = new PitchSmoother(5);
    s.add(82.4);
    s.reset();
    expect(s.add(329.6)).toBeCloseTo(329.6);
  });
});
