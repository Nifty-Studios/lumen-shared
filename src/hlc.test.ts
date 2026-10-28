import { describe, expect, it } from "vitest";
import { HlcClock, formatHlc, parseHlc } from "./hlc";
import { uuidv7 } from "./ids";

describe("HlcClock", () => {
  it("is strictly increasing even when the wall clock stalls or goes back", () => {
    let now = 1000;
    const clock = new HlcClock("dev", undefined, () => now);
    const a = clock.next();
    const b = clock.next();
    now = 500;
    const c = clock.next();
    expect(a < b && b < c).toBe(true);
  });

  it("orders local events after received remote ones", () => {
    const clock = new HlcClock("a", undefined, () => 1000);
    const remote = formatHlc({ wall: 5000, counter: 7, deviceId: "b" });
    clock.receive(remote);
    expect(clock.next() > remote).toBe(true);
  });

  it("resumes from a persisted timestamp", () => {
    const first = new HlcClock("a", undefined, () => 1000);
    first.next();
    const saved = first.current;
    const resumed = new HlcClock("a", saved, () => 1000);
    expect(resumed.next() > saved).toBe(true);
  });

  it("round-trips through format/parse", () => {
    const parts = { wall: 1730000000000, counter: 42, deviceId: uuidv7() };
    expect(parseHlc(formatHlc(parts))).toEqual(parts);
  });
});

describe("uuidv7", () => {
  it("is a v7 uuid that sorts by time", () => {
    const a = uuidv7(1000);
    const b = uuidv7(2000);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });
});
