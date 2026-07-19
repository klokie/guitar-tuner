/**
 * Reference-tone fallback (degraded mode: mic denied/unsupported/failed).
 * Simple plucked-string voice: triangle oscillator + exponential decay.
 * A beginner can't reliably tune by ear — this is a bridge, not the product.
 */

let ctx: AudioContext | null = null;

export function playReferenceTone(freq: number, seconds = 2): void {
  ctx ??= new AudioContext();
  void ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + seconds);
}
