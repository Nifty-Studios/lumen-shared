// Calendar events on the device. Each event is a block of type "event" that sits directly in
// its workspace (parent_table "space", never listed in `space.pages`), so it syncs, merges
// field by field and follows workspace roles exactly like a page does.
// Holidays and the birthday are added on read, never stored.

import { and, eq } from "drizzle-orm";
import { canEdit } from "../account";
import {
  addDays,
  birthdayEvent,
  CELEBRATIONS,
  celebrationAt,
  holidayEvents,
  isHm,
  isYmd,
  occurrences,
  remindersBetween,
  STICKERS,
  today,
  ymd,
  type CalendarEvent,
  type CelebrationId,
  type Repeat,
} from "../calendar";
import { uuidv7 } from "../ids";
import type { Json } from "../model";
import { setPath, type FieldChange } from "../ops";
import { plainText, richText } from "../text";
import { block, type Block } from "../schema/client";
import type { LocalStore } from "./store";
import type { Workspace } from "./workspace";
import type { SettingsApi } from "./settings";
import type { ProfileApi } from "./profile";
import type { AccountApi } from "./account";

export type EventInput = Partial<Omit<CalendarEvent, "id" | "spaceId" | "builtin" | "editable">>;

const REPEATS: Repeat[] = ["none", "daily", "weekly", "monthly", "yearly"];

function toEvent(b: Block, editable: boolean): CalendarEvent | undefined {
  const p = b.properties as Record<string, Json | undefined>;
  const f = b.format as Record<string, Json | undefined>;
  if (!isYmd(p.date)) return undefined;
  const reminders = Array.isArray(p.reminders) ? p.reminders.filter((m): m is number => typeof m === "number" && m >= 0) : [];
  return {
    id: b.id,
    spaceId: b.space_id,
    title: plainText(b.properties.title),
    date: p.date,
    time: isHm(p.time) ? p.time : null,
    endTime: isHm(p.end_time) ? p.end_time : null,
    repeat: REPEATS.includes(p.repeat as Repeat) ? (p.repeat as Repeat) : "none",
    until: isYmd(p.until) ? p.until : null,
    reminders,
    sticker: typeof f.sticker === "string" ? f.sticker : STICKERS[0]!.id,
    notes: typeof p.notes === "string" ? p.notes : "",
    celebrate: typeof f.celebrate === "string" && f.celebrate in CELEBRATIONS ? (f.celebrate as CelebrationId) : null,
    editable,
  };
}

/** The stored field each input field lives in. */
function changesFor(input: EventInput): FieldChange[] {
  const out: FieldChange[] = [];
  const put = (path: string[], value: Json) => out.push({ path, value });
  if (input.title !== undefined) put(["properties", "title"], richText(input.title.trim()));
  if (input.date !== undefined) {
    if (!isYmd(input.date)) throw new Error("Pick a day.");
    put(["properties", "date"], input.date);
  }
  if (input.time !== undefined) {
    if (input.time !== null && !isHm(input.time)) throw new Error("Pick a time.");
    put(["properties", "time"], input.time);
  }
  if (input.endTime !== undefined) put(["properties", "end_time"], input.endTime && isHm(input.endTime) ? input.endTime : null);
  if (input.repeat !== undefined) put(["properties", "repeat"], input.repeat);
  if (input.until !== undefined) put(["properties", "until"], input.until && isYmd(input.until) ? input.until : null);
  if (input.reminders !== undefined) put(["properties", "reminders"], [...new Set(input.reminders.filter((m) => Number.isFinite(m) && m >= 0).map(Math.round))].sort((a, b) => a - b));
  if (input.notes !== undefined) put(["properties", "notes"], input.notes);
  if (input.sticker !== undefined) put(["format", "sticker"], input.sticker);
  if (input.celebrate !== undefined) put(["format", "celebrate"], input.celebrate);
  return out;
}

export function createCalendar(store: LocalStore, workspace: Workspace, settings: SettingsApi, profile: ProfileApi, account: AccountApi) {
  const { db, write } = store;

  /** Your own events, in every workspace you can open on this device. */
  async function storedEvents(): Promise<CalendarEvent[]> {
    const roles = new Map((await workspace.listSpaces()).map((s) => [s.space.id, s.role]));
    const rows = await db.select().from(block).where(and(eq(block.type, "event"), eq(block.alive, true)));
    return rows.flatMap((b) => {
      const role = roles.get(b.space_id);
      const e = role ? toEvent(b, canEdit(role)) : undefined;
      return e ? [e] : [];
    });
  }

  /** The days Lumen adds by itself, around these dates. */
  function builtins(from: string, to: string): CalendarEvent[] {
    const out: CalendarEvent[] = settings.getSettings().holidays ? holidayEvents(from, to) : [];
    const birthday = profile.birthday();
    if (birthday) out.push(birthdayEvent(birthday, account.current?.user.name));
    return out;
  }

  /** Stored events plus holidays and the birthday, for a range of days. */
  async function eventsAround(from: string, to: string) {
    return [...(await storedEvents()), ...builtins(from, to)];
  }

  return {
    /** Every stored event (not expanded). */
    events: storedEvents,

    /** What happens from one day to another (inclusive), repeats expanded, sorted. */
    async between(from: string, to: string) {
      return occurrences(await eventsAround(from, to), from, to);
    },

    async getEvent(id: string): Promise<CalendarEvent | undefined> {
      if (id === "birthday" || id.startsWith("holiday:")) return (await eventsAround(addDays(today(), -400), addDays(today(), 400))).find((e) => e.id === id);
      const b = await workspace.getBlock(id);
      if (!b || b.type !== "event" || !b.alive) return undefined;
      return toEvent(b, canEdit(await workspace.roleOf(id)));
    },

    /** Adds an event to a workspace and returns its id. */
    async createEvent(spaceId: string, input: EventInput & { date: string }): Promise<string> {
      const role = (await workspace.listSpaces()).find((s) => s.space.id === spaceId)?.role;
      if (!canEdit(role)) throw new Error("You can only view this workspace.");
      const now = Date.now();
      const id = uuidv7();
      const base: EventInput = { title: "", time: null, endTime: null, repeat: "none", until: null, reminders: input.time ? [10] : [0], notes: "", sticker: STICKERS[0]!.id, celebrate: null };
      // One write shares one clock, so the nested fields go inside whole objects.
      const record: Record<string, Json> = { properties: {}, format: {} };
      for (const { path, value } of changesFor({ ...base, ...input })) setPath(record, path, value);
      const fields: Record<string, Json> = {
        space_id: spaceId,
        type: "event",
        properties: record.properties!,
        content: [],
        format: record.format!,
        parent_id: spaceId,
        parent_table: "space",
        collection_id: null,
        alive: true,
        created_time: now,
        last_edited_time: now,
      };
      await write([{ table: "block", id, changes: Object.entries(fields).map(([field, value]) => ({ path: [field], value })) }]);
      return id;
    },

    async updateEvent(id: string, input: EventInput) {
      const changes = changesFor(input);
      if (!changes.length) return;
      await write([{ table: "block", id, changes: [...changes, { path: ["last_edited_time"], value: Date.now() }] }]);
    },

    deleteEvent: (id: string) => write([{ table: "block", id, changes: [{ path: ["alive"], value: false }, { path: ["last_edited_time"], value: Date.now() }] }]),

    /** Reminders going off after `from` and up to `to` (epoch ms), honoring the settings. */
    async reminders(from: number, to: number, formatTime?: (hm: string) => string) {
      const s = settings.getSettings();
      if (!s.reminders && !s.holidayAlerts) return [];
      const events = (await eventsAround(ymd(new Date(from)), addDays(ymd(new Date(to)), 31))).filter((e) => (e.builtin ? s.holidayAlerts : s.reminders));
      return remindersBetween(events, from, to, formatTime);
    },

    /** The special day happening now, if celebrations are on. */
    async celebration(now = Date.now()) {
      if (!settings.getSettings().celebrations) return undefined;
      const day = ymd(new Date(now));
      return celebrationAt(await eventsAround(day, day), now);
    },
  };
}

export type CalendarApi = ReturnType<typeof createCalendar>;
