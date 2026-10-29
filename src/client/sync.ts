// Background sync with the relay server: push unsynced local ops, then pull other devices'
// ops past the saved cursor and commit them as remote. Safe to run any time; every step is
// idempotent (the server dedupes by op id, applyOp ignores ops it has already seen).
// While the app is in front, a live socket says when there is something new to pull.

import { asc, eq, inArray } from "drizzle-orm";
import type { LiveMessage } from "../account";
import type { Op } from "../ops";
import { MAX_PUSH_OPS, pullResponseSchema, pushResponseSchema, type PushRequest } from "../sync";
import { META_KEYS, meta, ops as opsTable } from "../schema/client";
import type { LocalStore } from "./store";

export interface SyncConfig {
  /** Server base URL, e.g. https://lumen-sync.fly.dev */
  url: string;
  /** The signed-in session's token; sync waits while there is none. */
  token: () => string | undefined;
  /** The server no longer accepts the token. */
  onUnauthorized?: () => void;
  /** The server refused some of this device's ops (e.g. edit rights were taken away). */
  onRejected?: (opIds: string[]) => void;
  /** The account's access changed (shared with, removed from…). Sync runs after it. */
  onAccessChanged?: () => Promise<void>;
  fetch?: typeof fetch;
  WebSocket?: typeof WebSocket;
}

export type SyncState = "idle" | "syncing" | "offline" | "error" | "signed-out";
export interface SyncStatus {
  state: SyncState;
  lastSyncedAt?: number;
  /** The live socket is open, so changes arrive within a second or so. */
  live?: boolean;
  error?: string;
}

class Unauthorized extends Error {}

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

  /** Pulls everything again from the start (after gaining access to something). */
  async resetCursor() {
    await this.store.db.delete(meta).where(eq(meta.key, META_KEYS.syncCursor));
  }

  /** Syncs now, every `intervalMs`, and shortly after local writes. Returns a stop function. */
  start({ intervalMs = 60_000, afterWriteMs = 800 } = {}) {
    const run = () => void this.sync().catch(() => {});
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const offChange = this.store.onChange((_, { remote }) => {
      if (remote) return;
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

  /**
   * Keeps a live socket open (reconnecting with backoff) so other devices' changes arrive
   * right away. Call when the app comes to the front; the returned function closes it.
   */
  live() {
    const Socket = this.config.WebSocket ?? globalThis.WebSocket;
    if (!Socket) return () => {};
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = 1_000;
    let stopped = false;

    const connect = () => {
      const token = this.config.token();
      if (stopped || !token) return;
      const url = new URL(this.config.url.replace(/\/+$/, "") + "/sync/live");
      url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
      url.searchParams.set("token", token);
      url.searchParams.set("device_id", this.store.deviceId);
      const ws = new Socket(url.toString());
      socket = ws;
      ws.onopen = () => {
        delay = 1_000;
        this.setStatus({ ...this.status, live: true });
        void this.sync().catch(() => {}); // catch up on anything missed while closed
      };
      ws.onmessage = (e) => {
        let msg: LiveMessage | undefined;
        try {
          msg = JSON.parse(String(e.data));
        } catch {}
        if (msg?.type === "ops") void this.sync().catch(() => {});
        if (msg?.type === "access") void (this.config.onAccessChanged?.() ?? Promise.resolve()).then(() => this.sync()).catch(() => {});
      };
      ws.onclose = () => {
        if (socket === ws) socket = undefined;
        this.setStatus({ ...this.status, live: false });
        if (stopped) return;
        retry = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 30_000);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      socket?.close();
      socket = undefined;
      this.setStatus({ ...this.status, live: false });
    };
  }

  private setStatus(next: SyncStatus) {
    this.status = next;
    for (const l of this.statusListeners) l(next);
  }

  private async runOnce() {
    if (!this.config.token()) {
      this.setStatus({ ...this.status, state: "signed-out" });
      return;
    }
    this.setStatus({ ...this.status, state: "syncing" });
    try {
      await this.push();
      await this.pull();
      const { error: _, ...rest } = this.status;
      this.setStatus({ ...rest, state: "idle", lastSyncedAt: Date.now() });
    } catch (e) {
      if (e instanceof Unauthorized) {
        this.setStatus({ ...this.status, state: "signed-out", live: false });
        this.config.onUnauthorized?.();
        return;
      }
      const offline = e instanceof TypeError; // fetch network failure
      this.setStatus({ ...this.status, state: offline ? "offline" : "error", error: String(e) });
      throw e;
    }
  }

  private async request(path: string, init?: RequestInit) {
    const doFetch = this.config.fetch ?? fetch;
    const res = await doFetch(this.config.url.replace(/\/+$/, "") + path, {
      ...init,
      headers: { authorization: `Bearer ${this.config.token() ?? ""}`, "content-type": "application/json" },
    });
    if (res.status === 401) throw new Unauthorized();
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
      const res = pushResponseSchema.parse(await this.request("/sync/push", { method: "POST", body: JSON.stringify(body) }));
      // Refused ops are marked synced too: retrying them would never succeed.
      await db.update(opsTable).set({ synced: true }).where(inArray(opsTable.id, rows.map((r) => r.id)));
      if (res.rejected.length) this.config.onRejected?.(res.rejected);
      // A workspace created here is the account's now; its access list should say so.
      if (rows.some((r) => r.table_name === "space" && r.path[0] === "created_time")) await this.config.onAccessChanged?.();
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
