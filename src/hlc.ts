// Hybrid logical clock. Encoded as a fixed-width string so plain string comparison
// gives the total order: wall ms, then counter, then device id (the tie-breaker).
//   "000001730000000000:000000:<device_id>"

export type Hlc = string;

const WALL_WIDTH = 15;
const COUNTER_WIDTH = 6;
const MAX_COUNTER = 10 ** COUNTER_WIDTH - 1;

export interface HlcParts {
  wall: number;
  counter: number;
  deviceId: string;
}

export function formatHlc({ wall, counter, deviceId }: HlcParts): Hlc {
  if (deviceId.includes(":")) throw new Error("deviceId must not contain ':'");
  return `${String(wall).padStart(WALL_WIDTH, "0")}:${String(counter).padStart(COUNTER_WIDTH, "0")}:${deviceId}`;
}

export function parseHlc(hlc: Hlc): HlcParts {
  const [wall, counter, ...rest] = hlc.split(":");
  const deviceId = rest.join(":");
  if (wall === undefined || counter === undefined || !deviceId) throw new Error(`invalid HLC: ${hlc}`);
  return { wall: Number(wall), counter: Number(counter), deviceId };
}

export class HlcClock {
  private wall: number;
  private counter: number;

  constructor(
    readonly deviceId: string,
    last?: Hlc,
    private readonly now: () => number = Date.now,
  ) {
    const parts = last ? parseHlc(last) : { wall: 0, counter: 0 };
    this.wall = parts.wall;
    this.counter = parts.counter;
  }

  /** Timestamp for a new local event. */
  next(): Hlc {
    const now = this.now();
    if (now > this.wall) {
      this.wall = now;
      this.counter = 0;
    } else {
      this.bump();
    }
    return this.current;
  }

  /** Fold in a timestamp seen from another device so later local events sort after it. */
  receive(remote: Hlc): void {
    const r = parseHlc(remote);
    const now = this.now();
    const wall = Math.max(now, this.wall, r.wall);
    if (wall === this.wall && wall === r.wall) this.counter = Math.max(this.counter, r.counter);
    else if (wall === r.wall) this.counter = r.counter;
    else if (wall !== this.wall) this.counter = -1;
    this.wall = wall;
    this.bump();
  }

  /** Last issued timestamp; persist it so the clock survives restarts. */
  get current(): Hlc {
    return formatHlc({ wall: this.wall, counter: this.counter, deviceId: this.deviceId });
  }

  private bump() {
    if (this.counter >= MAX_COUNTER) {
      this.wall += 1;
      this.counter = 0;
    } else {
      this.counter += 1;
    }
  }
}
