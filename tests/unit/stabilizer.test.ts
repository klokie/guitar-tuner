import { beforeEach, describe, expect, it } from "vitest";
import {
  HOLD_MS,
  IN_TUNE_CENTS,
  SIGNAL_MS,
  TuningSession,
  type FunnelEvent,
} from "@/lib/stabilizer";
import { TUNINGS } from "@/lib/tunings";

const STANDARD = TUNINGS.standard!;

/** Deterministic clock + captured events. */
function makeSession() {
  let t = 0;
  const events: FunnelEvent[] = [];
  const session = new TuningSession(STANDARD, (e) => events.push(e), () => t);
  const advance = (ms: number) => {
    t += ms;
  };
  return { session, events, advance };
}

const names = (events: FunnelEvent[]) => events.map((e) => e.name);

describe("signal_detected", () => {
  it("fires after a sustained confident reading, once", () => {
    const { session, events, advance } = makeSession();
    session.update(0, 20);
    advance(SIGNAL_MS);
    session.update(0, 20);
    expect(names(events)).toContain("signal_detected");
    advance(1000);
    session.update(0, 20);
    expect(names(events).filter((n) => n === "signal_detected")).toHaveLength(1);
  });

  it("does not fire for a blip shorter than SIGNAL_MS", () => {
    const { session, events, advance } = makeSession();
    session.update(0, 20);
    advance(SIGNAL_MS - 50);
    session.update(null, null); // signal lost — timer resets
    advance(1000);
    session.update(0, 20);
    expect(names(events)).not.toContain("signal_detected");
  });
});

describe("string_stabilized", () => {
  it("fires after in-tune held HOLD_MS", () => {
    const { session, events, advance } = makeSession();
    session.update(0, 2);
    advance(HOLD_MS);
    session.update(0, -2);
    expect(names(events)).toContain("string_stabilized");
    expect(session.states[0]).toBe("done");
  });

  it("a wobble beyond IN_TUNE_CENTS resets the hold timer", () => {
    const { session, events, advance } = makeSession();
    session.update(0, 2);
    advance(HOLD_MS - 100);
    session.update(0, IN_TUNE_CENTS + 5); // wobble out
    advance(200);
    session.update(0, 2); // back in — timer restarted
    advance(HOLD_MS - 100);
    session.update(0, 2);
    expect(names(events)).not.toContain("string_stabilized");
    advance(100);
    session.update(0, 2);
    expect(names(events)).toContain("string_stabilized");
  });

  it("switching strings mid-hold does not stabilize the first string", () => {
    const { session, events, advance } = makeSession();
    session.update(0, 2);
    advance(HOLD_MS - 100);
    session.update(1, 2); // engine now hears another string
    advance(HOLD_MS);
    session.update(1, 2);
    expect(session.states[0]).not.toBe("done");
    expect(session.states[1]).toBe("done");
    expect(names(events).filter((n) => n === "string_stabilized")).toHaveLength(1);
  });
});

describe("tuning_completed", () => {
  const tuneAll = (
    session: TuningSession,
    advance: (ms: number) => void,
  ): void => {
    for (let i = 0; i < 6; i++) {
      session.update(i, 0);
      advance(HOLD_MS);
      session.update(i, 0);
    }
  };

  it("fires exactly once when all six strings are done", () => {
    const { session, events, advance } = makeSession();
    tuneAll(session, advance);
    expect(names(events).filter((n) => n === "tuning_completed")).toHaveLength(1);
    // Re-tuning a string afterward must not re-fire completion.
    session.update(0, 0);
    advance(HOLD_MS);
    session.update(0, 0);
    expect(names(events).filter((n) => n === "tuning_completed")).toHaveLength(1);
  });

  it("does not fire with five of six strings done", () => {
    const { session, events, advance } = makeSession();
    for (let i = 0; i < 5; i++) {
      session.update(i, 0);
      advance(HOLD_MS);
      session.update(i, 0);
    }
    expect(names(events)).not.toContain("tuning_completed");
  });

  it("reports duration since signal_detected", () => {
    const { session, events, advance } = makeSession();
    session.update(0, 20);
    advance(SIGNAL_MS);
    session.update(0, 20);
    tuneAll(session, advance);
    const completed = events.find((e) => e.name === "tuning_completed");
    expect(completed?.props?.since_signal_ms).toBeTypeOf("number");
    expect(completed?.props?.since_signal_ms as number).toBeGreaterThan(0);
  });
});

describe("fallback sessions", () => {
  it("tags the session and suppresses funnel events", () => {
    const { session, events, advance } = makeSession();
    session.enterFallback("denied");
    expect(names(events)).toContain("fallback_mode");
    session.update(0, 2);
    advance(HOLD_MS + SIGNAL_MS);
    session.update(0, 2);
    expect(names(events)).not.toContain("signal_detected");
    expect(names(events)).not.toContain("string_stabilized");
  });

  it("enterFallback is idempotent", () => {
    const { session, events } = makeSession();
    session.enterFallback("denied");
    session.enterFallback("denied");
    expect(names(events).filter((n) => n === "fallback_mode")).toHaveLength(1);
  });
});
