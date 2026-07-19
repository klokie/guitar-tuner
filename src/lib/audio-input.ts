/**
 * Microphone acquisition + environment detection.
 *
 * The constraints are the most load-bearing lines in the audio path:
 * browser voice processing (echo cancellation, noise suppression, AGC)
 * actively mangles instrument signals — a tuner must turn all three off.
 */

export type AudioEnv =
  | { ok: true }
  | {
      ok: false;
      reason: "webview" | "insecure-context" | "no-getusermedia" | "no-audiocontext";
    };

const WEBVIEW_UA =
  /\b(Instagram|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger|GSA\/|TikTok|Snapchat)\b/i;

export function detectEnvironment(
  nav: Navigator = navigator,
  win: Window = window,
): AudioEnv {
  if (WEBVIEW_UA.test(nav.userAgent)) return { ok: false, reason: "webview" };
  // Browsers only expose mediaDevices on HTTPS or localhost. Over plain HTTP
  // (e.g. a LAN IP) the mic is missing by policy, not by browser capability —
  // the UX message must say so or it blames the wrong thing.
  if (win.isSecureContext === false) return { ok: false, reason: "insecure-context" };
  if (!nav.mediaDevices?.getUserMedia) return { ok: false, reason: "no-getusermedia" };
  if (!("AudioContext" in win) && !("webkitAudioContext" in win)) {
    return { ok: false, reason: "no-audiocontext" };
  }
  return { ok: true };
}

export interface MicSession {
  context: AudioContext;
  analyser: AnalyserNode;
  stream: MediaStream;
  stop: () => void;
}

/** Must be called from a user gesture (iOS Safari requirement). */
export async function openMic(windowSize: number): Promise<MicSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  const context = new AudioContext();
  await context.resume();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = windowSize;
  source.connect(analyser);
  return {
    context,
    analyser,
    stream,
    stop: () => {
      stream.getTracks().forEach((t) => t.stop());
      void context.close();
    },
  };
}
