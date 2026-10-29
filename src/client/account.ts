// The account on this device: who is signed in (the session token lives in `meta`, which is
// device-local and never synced), what they can access, the reminder for people who chose
// "Later" at first launch, and the server calls for sharing.

import { eq, inArray } from "drizzle-orm";
import {
  authResponseSchema,
  meSchema,
  peopleSchema,
  type InviteRequest,
  type Me,
  type Person,
  type User,
} from "../account";
import { meta } from "../schema/client";
import type { LumenDb } from "./driver";

export interface ServerConfig {
  /** e.g. https://lumen-sync.fly.dev */
  url: string;
  /** Shown in the account's device list, e.g. "Windows desktop". */
  deviceName: string;
  /** The shared token from before accounts, to claim workspaces stored back then. */
  legacyToken?: string | undefined;
  fetch?: typeof fetch;
}

export interface Account {
  user: User;
  token: string;
}

export type Access = Omit<Me, "user">;

const KEYS = { account: "account", access: "access", skipped: "auth_skipped", remindAt: "auth_remind_at" } as const;
const REMIND_EVERY = 3 * 86_400_000;

/** A failed account call, with a message fit to show as is. */
export class AccountError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 when the server couldn't be reached. */
    readonly status: number,
  ) {
    super(message);
  }
}

export function createAccount(db: LumenDb, server: ServerConfig | undefined) {
  let account: Account | undefined;
  let access: Access = { spaces: [], pages: [] };
  let skipped = false;
  let remindAt = 0;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  const save = (key: string, value: unknown) =>
    db
      .insert(meta)
      .values({ key, value: JSON.stringify(value) })
      .onConflictDoUpdate({ target: meta.key, set: { value: JSON.stringify(value) } });

  async function load() {
    const rows = await db.select().from(meta).where(inArray(meta.key, Object.values(KEYS)));
    const get = (key: string) => {
      const raw = rows.find((r) => r.key === key)?.value;
      return raw === undefined ? undefined : JSON.parse(raw);
    };
    account = get(KEYS.account);
    access = get(KEYS.access) ?? { spaces: [], pages: [] };
    skipped = get(KEYS.skipped) ?? false;
    remindAt = get(KEYS.remindAt) ?? 0;
  }

  async function request<T>(path: string, init: RequestInit & { token?: string; schema?: { parse: (x: unknown) => T } } = {}): Promise<T> {
    if (!server) throw new AccountError("Sync isn't set up in this build.", 0);
    const { token, schema, headers, ...rest } = init;
    let res: Response;
    try {
      res = await (server.fetch ?? fetch)(server.url.replace(/\/+$/, "") + path, {
        ...rest,
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
      });
    } catch {
      throw new AccountError("Can't reach Lumen's server. Check your connection and try again.", 0);
    }
    const body = (await res.json().catch(() => ({}))) as { error?: unknown };
    if (!res.ok) throw new AccountError(typeof body?.error === "string" ? body.error : `Something went wrong (${res.status}).`, res.status);
    return schema ? schema.parse(body) : (body as T);
  }

  const authed = <T>(path: string, init: RequestInit & { schema?: { parse: (x: unknown) => T } } = {}) => {
    if (!account) throw new AccountError("Sign in first.", 401);
    return request<T>(path, { ...init, token: account.token });
  };

  async function signedIn(next: Account) {
    account = next;
    skipped = false;
    await db.batch([save(KEYS.account, next), save(KEYS.skipped, false)]);
    emit();
  }

  const people = (path: string, method = "GET", body?: unknown) =>
    authed(path, { method, schema: peopleSchema, ...(body ? { body: JSON.stringify(body) } : {}) }).then((r) => r.people as Person[]);

  return {
    load,
    get current() {
      return account;
    },
    get access() {
      return access;
    },
    onChange(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    /** Whether this build talks to a server at all. */
    available: !!server,

    async signUp(input: { email: string; password: string; name: string }) {
      const res = await request("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ ...input, device_name: server?.deviceName ?? "Lumen" }),
        schema: authResponseSchema,
      });
      await signedIn(res);
    },
    async logIn(input: { email: string; password: string }) {
      const res = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ ...input, device_name: server?.deviceName ?? "Lumen" }),
        schema: authResponseSchema,
      });
      await signedIn(res);
    },
    /** Forgets the session on this device (the caller clears local data). */
    async logOut() {
      if (account) await authed("/auth/logout", { method: "POST" }).catch(() => {});
      account = undefined;
      access = { spaces: [], pages: [] };
      await db.delete(meta).where(inArray(meta.key, [KEYS.account, KEYS.access]));
      emit();
    },
    /** The server said the session is no longer valid (signed out elsewhere, or expired). */
    async expire() {
      account = undefined;
      await db.delete(meta).where(eq(meta.key, KEYS.account));
      emit();
    },

    /** Fetches what this account can access. Returns what was gained and lost since last time. */
    async refreshAccess() {
      const me = await authed("/me", { schema: meSchema });
      const before = scopes(access);
      access = { spaces: me.spaces, pages: me.pages };
      if (account && (account.user.name !== me.user.name || account.user.email !== me.user.email)) account = { ...account, user: me.user };
      await db.batch([save(KEYS.access, access), ...(account ? [save(KEYS.account, account)] : [])]);
      const after = scopes(access);
      emit();
      return {
        gained: [...after].filter((s) => !before.has(s)),
        lost: [...before].filter((s) => !after.has(s)),
      };
    },
    /** Workspaces stored before accounts existed become this account's (needs the old token). */
    async claimLegacy() {
      if (!server?.legacyToken || !account) return 0;
      const res = await authed<{ claimed: number }>("/auth/claim-legacy", { method: "POST", headers: { "x-legacy-token": server.legacyToken } });
      return res.claimed;
    },

    // "Later" at first launch, and the reminder after.
    get skipped() {
      return skipped;
    },
    async skip() {
      skipped = true;
      remindAt = Date.now() + REMIND_EVERY;
      await db.batch([save(KEYS.skipped, true), save(KEYS.remindAt, remindAt)]);
      emit();
    },
    reminderDue: () => !account && skipped && !!server && Date.now() >= remindAt,
    async snoozeReminder() {
      remindAt = Date.now() + REMIND_EVERY;
      await save(KEYS.remindAt, remindAt);
      emit();
    },

    // Sharing.
    members: (spaceId: string) => people(`/spaces/${spaceId}/members`),
    invite: (spaceId: string, invite: InviteRequest) => people(`/spaces/${spaceId}/members`, "POST", invite),
    removeMember: (spaceId: string, email: string) => people(`/spaces/${spaceId}/members`, "DELETE", { email }),
    pageShares: (pageId: string) => people(`/pages/${pageId}/shares`),
    sharePage: (pageId: string, invite: { email: string; role: "editor" | "viewer" }) => people(`/pages/${pageId}/shares`, "POST", invite),
    unsharePage: (pageId: string, email: string) => people(`/pages/${pageId}/shares`, "DELETE", { email }),
  };
}

const scopes = (a: Access) => new Set([...a.spaces.map((s) => `space:${s.id}`), ...a.pages.map((p) => `page:${p.id}`)]);

export type AccountApi = ReturnType<typeof createAccount>;
