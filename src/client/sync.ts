// Background sync with the relay server: push unsynced local ops, then pull other devices'
// ops past the saved cursor and commit them as remote. Safe to run any time; every step is
// idempotent (the server dedupes by op id, applyOp ignores ops it has already seen).

import { asc, eq, inArray } from "drizzle-orm";
import type { Op } from "../ops";
import { MAX_PUSH_OPS, pullResponseSchema, pushResponseSchema, type PushRequest } from "../sync";
import { META_KEYS, meta, ops as opsTable } from "../schema/client";
import type { LocalStore } from "./store";

export interface SyncConfig {
  /** Server base URL, e.g. https://lumen-sync.fly.dev */
  url: string;
  token: string;
  fetch?: typeof fetch;
}

export type SyncState = "idle" | "syncing" | "offline" | "error";
export interface SyncStatus {
  state: SyncState;
  lastSyncedAt?: number;
  error?: string;
}

export class SyncClient {
  private running: Promise<void> | undefined;
  private again = false;
  private status: SyncStatus = { state: "idle" };
  private statusListeners = new Set<(s: SyncStatus) => void>();

  constructor(
    private store: LocalStore,
    private config: SyncConfig,
  ) {}

  get current() {
    return this.status;
  }

  onStatus = (listener: (s: SyncStatus) => void) => {
    this.statusListeners.add(listener);
    return () => void this.statusListeners.delete(listener);
  };

  /** One push + pull. Concurrent calls share the run in progress (and queue one more). */
  sync = (): Promise<void> => {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        await this.runOnce();
      } while (this.again);
    })().finally(() => (this.running = undefined));
    return this.running;
  };

  /** Syncs now, every `intervalMs`, and shortly after local writes. Returns a stop function. */
  start({ intervalMs = 60_000, afterWriteMs = 2_000 } = {}) {
    const run = () => void this.sync().catch(() => {});
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const offChange = this.store.onChange(() => {
      clearTimeout(debounce);
      debounce = setTimeout(run, afterWriteMs);
    });
    const interval = setInterval(run, intervalMs);
    run();
    return () => {
      offChange();
      clearTimeout(debounce);
      clearInterval(interval);
    };
  }

  private setStatus(next: SyncStatus) {
    this.status = next;
    for (const l of this.statusListeners) l(next);
  }

  private async runOnce() {
    this.setStatus({ ...this.status, state: "syncing" });
    try {
      await this.push();
      await this.pull();
      this.setStatus({ state: "idle", lastSyncedAt: Date.now() });
    } catch (e) {
      const offline = e instanceof TypeError; // fetch network failure
      this.setStatus({ ...this.status, state: offline ? "offline" : "error", error: String(e) });
      throw e;
    }
  }

  private async request(path: string, init?: RequestInit) {
    const doFetch = this.config.fetch ?? fetch;
    const res = await doFetch(this.config.url.replace(/\/+$/, "") + path, {
      ...init,
      headers: { authorization: `Bearer ${this.config.token}`, "content-type": "application/json" },
    });
    if (!res.ok) throw new Error(`Sync server answered ${res.status} for ${path}`);
    return res.json();
  }

  private async push() {
    const { db } = this.store;
    for (;;) {
      const rows = await db
        .select()
        .from(opsTable)
        .where(eq(opsTable.synced, false))
        .orderBy(asc(opsTable.hlc))
        .limit(MAX_PUSH_OPS);
      if (!rows.length) return;
      const body: PushRequest = {
        device_id: this.store.deviceId,
        ops: rows.map(({ table_name, synced: _, ...op }) => ({ ...op, table: table_name })),
      };
      pushResponseSchema.parse(await this.request("/sync/push", { method: "POST", body: JSON.stringify(body) }));
      await db.update(opsTable).set({ synced: true }).where(inArray(opsTable.id, rows.map((r) => r.id)));
      if (rows.length < MAX_PUSH_OPS) return;
    }
  }

  private async pull() {
    const { db } = this.store;
    const [row] = await db.select().from(meta).where(eq(meta.key, META_KEYS.syncCursor));
    let cursor = Number(row?.value ?? 0);
    for (;;) {
      const query = `?since=${cursor}&device_id=${encodeURIComponent(this.store.deviceId)}`;
      const res = pullResponseSchema.parse(await this.request(`/sync/pull${query}`));
      if (res.ops.length) await this.store.commit(res.ops as Op[], { remote: true });
      cursor = res.cursor;
      await db
        .insert(meta)
        .values({ key: META_KEYS.syncCursor, value: String(cursor) })
        .onConflictDoUpdate({ target: meta.key, set: { value: String(cursor) } });
      if (!res.has_more) return;
    }
  }
}
