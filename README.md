# guitar-tuner

Free online guitar tuner — microphone in, beginner-first, no install, no
sign-up. All audio is processed locally in the browser; nothing is uploaded.

Design doc: `~/vault/work-ideas/idea-online-guitar-tuner/2026-07-19-design-one-perfect-page.md`

## Stack

- Astro 5 (static) + `@klokie/theme`, per `~/vault/resources/programming/klokie-web-stack.md`
- Pitch detection: [pitchy](https://github.com/ianprime0509/pitchy) (McLeod Pitch
  Method) fed by a main-thread `AnalyserNode` polled ~25×/s — no worklet, no Wasm
- PostHog (EU, cookieless) funnel + Sentry; both no-op locally
- Cloudflare Workers static assets (`wrangler deploy`)

## Routes

| Route             | Tuning                          |
| ----------------- | ------------------------------- |
| `/`               | Standard (E A D G B E)          |
| `/drop-d`         | Drop D (D A D G B E)            |
| `/half-step-down` | Half step down (E♭ tuning)      |

Adding a guitar-family tuning = one entry in `src/lib/tunings.ts` + one thin
page using `TunerPage.astro`. Other instruments (ukulele) need their own
headstock geometry — see the design doc before bolting them on.

## Development

```bash
pnpm install
pnpm dev          # server.host=true — this Mac needs it (IPv6-first localhost)
pnpm test         # unit tests (engine, state machine, tunings, env detection)
pnpm build && pnpm test:seo   # SEO baseline against dist/
pnpm test:e2e     # Playwright with a fake microphone (generates WAV fixtures)
```

The funnel events (`mic_granted → signal_detected → string_stabilized →
tuning_completed`) are defined in `src/lib/stabilizer.ts` — their semantics are
the product's success gate; change them only in step with the design doc.

`tests/fixtures/real-plucks/` wants real phone-mic recordings of each open
string (see its README) — the octave-error tests are only honest with real
signals.

## Deploy

`pnpm deploy` (wrangler, Workers static assets). Domain decision (standalone
vs `tuner.klokie.com`) is design-doc task T10; `PUBLIC_SITE_URL` defaults to
`tuner.klokie.com` until settled.
