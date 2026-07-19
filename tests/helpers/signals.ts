/** Synthetic test signals for the pitch engine. */

export function sine(freq: number, sampleRate: number, length: number): Float32Array {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buf[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return buf;
}

/**
 * Sawtooth-ish tone with a deliberately weak fundamental — models a phone
 * mic hearing a low guitar string (strong 2nd/3rd harmonics, quiet
 * fundamental). The classic octave-error input.
 */
export function weakFundamental(
  freq: number,
  sampleRate: number,
  length: number,
): Float32Array {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = (2 * Math.PI * freq * i) / sampleRate;
    buf[i] =
      0.15 * Math.sin(t) + 0.6 * Math.sin(2 * t) + 0.35 * Math.sin(3 * t) + 0.2 * Math.sin(4 * t);
  }
  return buf;
}

export function whiteNoise(length: number, amplitude = 0.3): Float32Array {
  const buf = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buf[i] = (Math.random() * 2 - 1) * amplitude;
  }
  return buf;
}

export const silence = (length: number): Float32Array => new Float32Array(length);
