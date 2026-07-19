# Real phone-mic pluck fixtures

Design doc task (D5.4): record each open string of a real guitar with a
phone microphone and drop the WAVs here, named `<note>-<freq>.wav`:

```
E2-82.41.wav  A2-110.00.wav  D3-146.83.wav
G3-196.00.wav B3-246.94.wav  E4-329.63.wav
```

Include one deliberately muddy low E (recorded ~1m from the phone) — that's
the classic octave-error input the engine must survive.

`tests/unit/pitch-engine.test.ts` auto-includes any WAV found here
(16-bit PCM, mono or stereo). Until files exist, that suite is skipped.
