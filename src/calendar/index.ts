// The calendar: events (stored as `event` blocks, so they sync and share like pages), the
// special days Lumen knows by itself (holidays and your birthday), repeats, reminders, and
// the celebrations that take over the sky on a special day. Pure functions, no database.
//
// Dates are local calendar days ("2026-12-25") and times local wall-clock ("14:30"), so an
// event stays on its day when the device changes timezone, like a paper diary.

import type { IconName } from "../icons/data";

export type Repeat = "none" | "daily" | "weekly" | "monthly" | "yearly";
export type CelebrationId = "new-year" | "valentine" | "easter" | "halloween" | "christmas" | "birthday" | "party";

export interface CalendarEvent {
  id: string;
  /** Workspace it lives in (built-in days have none). */
  spaceId: string | null;
  title: string;
  /** First (or only) day, YYYY-MM-DD. */
  date: string;
  /** HH:MM, or null for an all-day event. */
  time: string | null;
  endTime: string | null;
  repeat: Repeat;
  /** Last day a repeating event happens (inclusive), or null for forever. */
  until: string | null;
  /** Minutes before the start to remind. All-day events count from 09:00 on the day. */
  reminders: number[];
  /** A sticker id from STICKERS. */
  sticker: string;
  notes: string;
  /** Turn the sky into this celebration on the day. */
  celebrate: CelebrationId | null;
  /** Holidays and birthdays are computed, not stored. */
  builtin?: "holiday" | "birthday" | undefined;
  /** Can the person change it (role in its workspace). */
  editable?: boolean | undefined;
}

export interface Occurrence {
  event: CalendarEvent;
  date: string;
  /** Start in epoch ms (all-day: midnight). */
  start: number;
}

// ---- stickers -------------------------------------------------------------------------

export interface Sticker {
  id: string;
  icon: IconName;
  /** An icon color token (icons/index.ts). */
  color: string;
  label: string;
}

/** The stickers people put on days. The first one is the default. */
export const STICKERS: Sticker[] = [
  { id: "star", icon: "star", color: "yellow", label: "Star" },
  { id: "party", icon: "party-popper", color: "pink", label: "Party" },
  { id: "cake", icon: "cake", color: "orange", label: "Birthday" },
  { id: "heart", icon: "heart", color: "red", label: "Love" },
  { id: "gift", icon: "gift", color: "purple", label: "Gift" },
  { id: "work", icon: "briefcase", color: "brown", label: "Work" },
  { id: "meeting", icon: "users", color: "blue", label: "Meeting" },
  { id: "call", icon: "phone", color: "teal", label: "Call" },
  { id: "travel", icon: "plane", color: "blue", label: "Travel" },
  { id: "food", icon: "utensils", color: "orange", label: "Food" },
  { id: "coffee", icon: "coffee", color: "brown", label: "Coffee" },
  { id: "sport", icon: "dumbbell", color: "green", label: "Workout" },
  { id: "study", icon: "graduation-cap", color: "purple", label: "Study" },
  { id: "book", icon: "book-open", color: "teal", label: "Reading" },
  { id: "health", icon: "heart-pulse", color: "red", label: "Health" },
  { id: "game", icon: "gamepad-2", color: "green", label: "Games" },
  { id: "film", icon: "film", color: "gray", label: "Film" },
  { id: "money", icon: "wallet", color: "green", label: "Money" },
  { id: "home", icon: "house", color: "yellow", label: "Home" },
  { id: "alarm", icon: "alarm-clock", color: "red", label: "Deadline" },
];
// Stickers only the built-in days use.
const BUILTIN_STICKERS: Sticker[] = [
  { id: "new-year", icon: "sparkles", color: "yellow", label: "New Year" },
  { id: "valentine", icon: "heart", color: "pink", label: "Valentine's Day" },
  { id: "easter", icon: "egg", color: "green", label: "Easter" },
  { id: "halloween", icon: "ghost", color: "orange", label: "Halloween" },
  { id: "christmas", icon: "tree-pine", color: "green", label: "Christmas" },
  { id: "birthday", icon: "cake", color: "pink", label: "Birthday" },
];

export const stickerOf = (id: string | undefined): Sticker =>
  STICKERS.find((s) => s.id === id) ?? BUILTIN_STICKERS.find((s) => s.id === id) ?? STICKERS[0]!;

// ---- dates ----------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Local midnight of a YYYY-MM-DD day. */
export const parseYmd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};
export const addDays = (s: string, n: number) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const today = (now = Date.now()) => ymd(new Date(now));
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
export const isYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseYmd(s).getTime());
export const isHm = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Epoch ms of a day at a wall-clock time (local). */
export function at(date: string, time: string | null) {
  const d = parseYmd(date);
  if (time) {
    const [h, m] = time.split(":").map(Number);
    d.setHours(h ?? 0, m ?? 0, 0, 0);
  }
  return d.getTime();
}

/** All-day reminders count back from this time on the day. */
export const ALL_DAY_REMINDER_TIME = "09:00";

/** Does the event happen on this day? */
export function occursOn(e: Pick<CalendarEvent, "date" | "repeat" | "until">, date: string): boolean {
  if (date < e.date) return false;
  if (e.until && date > e.until) return false;
  if (date === e.date) return true;
  const start = parseYmd(e.date);
  const day = parseYmd(date);
  switch (e.repeat) {
    case "daily":
      return true;
    case "weekly":
      return start.getDay() === day.getDay();
    case "monthly":
      // The 31st only happens in months that have one.
      return start.getDate() === day.getDate();
    case "yearly": {
      if (start.getMonth() !== day.getMonth()) return false;
      if (start.getDate() === day.getDate()) return true;
      // Born on 29 February: the 28th in other years.
      return start.getMonth() === 1 && start.getDate() === 29 && day.getDate() === 28 && daysInMonth(day.getFullYear(), 1) === 28;
    }
    default:
      return false;
  }
}

/** Every occurrence from `from` to `to` (inclusive days), sorted by start. */
export function occurrences(events: CalendarEvent[], from: string, to: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (let date = from, guard = 0; date <= to && guard < 800; date = addDays(date, 1), guard++)
    for (const event of events) if (occursOn(event, date)) out.push({ event, date, start: at(date, event.time) });
  return out.sort((a, b) => a.start - b.start || (a.event.time ? 1 : 0) - (b.event.time ? 1 : 0) || a.event.title.localeCompare(b.event.title));
}

// ---- built-in days ----------------------------------------------------------------------

/** Easter Sunday (Gregorian, the Meeus/Jones/Butcher method). */
export function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export interface Holiday {
  id: string;
  name: string;
  sticker: string;
  celebrate: CelebrationId;
  /** What the notification says on the morning of the day. */
  greeting: string;
  date: (year: number) => string;
}

export const HOLIDAYS: Holiday[] = [
  { id: "new-year", name: "New Year's Day", sticker: "new-year", celebrate: "new-year", greeting: "Happy New Year!", date: (y) => `${y}-01-01` },
  { id: "valentine", name: "Valentine's Day", sticker: "valentine", celebrate: "valentine", greeting: "Happy Valentine's Day", date: (y) => `${y}-02-14` },
  { id: "easter", name: "Easter Sunday", sticker: "easter", celebrate: "easter", greeting: "Happy Easter", date: easter },
  { id: "halloween", name: "Halloween", sticker: "halloween", celebrate: "halloween", greeting: "Happy Halloween", date: (y) => `${y}-10-31` },
  { id: "christmas-eve", name: "Christmas Eve", sticker: "christmas", celebrate: "christmas", greeting: "It's Christmas Eve", date: (y) => `${y}-12-24` },
  { id: "christmas", name: "Christmas Day", sticker: "christmas", celebrate: "christmas", greeting: "Merry Christmas!", date: (y) => `${y}-12-25` },
  { id: "new-years-eve", name: "New Year's Eve", sticker: "new-year", celebrate: "new-year", greeting: "Last day of the year. See it out in style", date: (y) => `${y}-12-31` },
];

/** The holidays between two days, as events. */
export function holidayEvents(from: string, to: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (let y = parseYmd(from).getFullYear(); y <= parseYmd(to).getFullYear(); y++)
    for (const h of HOLIDAYS) {
      const date = h.date(y);
      if (date < from || date > to) continue;
      out.push({
        id: `holiday:${h.id}:${y}`,
        spaceId: null,
        title: h.name,
        date,
        time: null,
        endTime: null,
        repeat: "none",
        until: null,
        reminders: [0],
        sticker: h.sticker,
        notes: h.greeting,
        celebrate: h.celebrate,
        builtin: "holiday",
      });
    }
  return out;
}

/** A birthday as saved on the account: "MM-DD", or "YYYY-MM-DD" with the year. */
export const isBirthday = (s: unknown): s is string => typeof s === "string" && (/^\d{2}-\d{2}$/.test(s) ? isYmd(`2000-${s}`) : isYmd(s));

/** Your birthday as a yearly event. */
export function birthdayEvent(birthday: string, name?: string): CalendarEvent {
  const md = birthday.length === 5 ? birthday : birthday.slice(5);
  const first = name?.trim().split(/\s+/)[0];
  return {
    id: "birthday",
    spaceId: null,
    title: "Your birthday",
    // Leap-year anchor, so a 29 February birthday works (and falls back to the 28th).
    date: `2000-${md}`,
    time: null,
    endTime: null,
    repeat: "yearly",
    until: null,
    reminders: [0],
    sticker: "birthday",
    notes: first ? `Happy birthday, ${first}!` : "Happy birthday!",
    celebrate: "birthday",
    builtin: "birthday",
  };
}

/** How old someone born on `birthday` turns on `date` (undefined without a birth year). */
export function ageOn(birthday: string, date: string): number | undefined {
  if (birthday.length !== 10) return undefined;
  return Number(date.slice(0, 4)) - Number(birthday.slice(0, 4));
}

// ---- reminders --------------------------------------------------------------------------

export interface ReminderOption {
  minutes: number;
  label: string;
}

export const REMINDER_OPTIONS: ReminderOption[] = [
  { minutes: 0, label: "At the time" },
  { minutes: 5, label: "5 minutes before" },
  { minutes: 10, label: "10 minutes before" },
  { minutes: 15, label: "15 minutes before" },
  { minutes: 30, label: "30 minutes before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 120, label: "2 hours before" },
  { minutes: 1440, label: "1 day before" },
  { minutes: 2880, label: "2 days before" },
  { minutes: 10080, label: "1 week before" },
];

export const ALL_DAY_REMINDER_OPTIONS: ReminderOption[] = [
  { minutes: 0, label: "On the day, 9:00" },
  { minutes: 1440, label: "1 day before, 9:00" },
  { minutes: 2880, label: "2 days before, 9:00" },
  { minutes: 10080, label: "1 week before, 9:00" },
];

/** "15 minutes before", "3 hours before", "2 days before". */
export function reminderLabel(minutes: number, allDay: boolean): string {
  const known = (allDay ? ALL_DAY_REMINDER_OPTIONS : REMINDER_OPTIONS).find((o) => o.minutes === minutes);
  if (known) return known.label;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"} before`;
  if (minutes % 10080 === 0) return unit(minutes / 10080, "week");
  if (minutes % 1440 === 0) return unit(minutes / 1440, "day");
  if (minutes % 60 === 0) return unit(minutes / 60, "hour");
  return unit(minutes, "minute");
}

export const REPEAT_OPTIONS: { value: Repeat; label: string }[] = [
  { value: "none", label: "Doesn't repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "yearly", label: "Every year" },
];

export interface Reminder {
  /** Stable per event, day and offset, so a reminder is told once. */
  key: string;
  /** When to tell, epoch ms. */
  at: number;
  title: string;
  body: string;
  eventId: string;
  date: string;
  /** Built-in days notify with their greeting. */
  builtin?: "holiday" | "birthday" | undefined;
}

const MAX_OFFSET_DAYS = 31;

/**
 * Reminders that go off after `from` and up to `to` (epoch ms). `formatTime` turns "14:30"
 * into what the person reads ("2:30 PM").
 */
export function remindersBetween(events: CalendarEvent[], from: number, to: number, formatTime: (hm: string) => string = (s) => s): Reminder[] {
  const maxOffset = Math.min(MAX_OFFSET_DAYS, Math.ceil(Math.max(0, ...events.flatMap((e) => e.reminders)) / 1440) + 1);
  const firstDay = ymd(new Date(from));
  const lastDay = addDays(ymd(new Date(to)), maxOffset);
  const out: Reminder[] = [];
  for (const occ of occurrences(events, firstDay, lastDay)) {
    const { event, date } = occ;
    const base = at(date, event.time ?? ALL_DAY_REMINDER_TIME);
    for (const minutes of new Set(event.reminders)) {
      const when = base - minutes * 60_000;
      if (when <= from || when > to) continue;
      out.push({ key: `${event.id}:${date}:${minutes}`, at: when, eventId: event.id, date, builtin: event.builtin, ...describe(event, date, minutes, formatTime) });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

function describe(event: CalendarEvent, date: string, minutes: number, formatTime: (hm: string) => string) {
  if (event.builtin && minutes === 0) return { title: event.notes || event.title, body: event.builtin === "birthday" ? "Lumen is celebrating with you today." : event.title };
  const time = event.time ? formatTime(event.time) : undefined;
  const when =
    minutes === 0
      ? time
        ? `Now · ${time}`
        : "Today"
      : minutes % 1440 === 0 && !event.time
      ? minutes === 1440
        ? "Tomorrow"
        : `In ${minutes / 1440} days · ${parseYmd(date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}`
      : `${reminderLabel(minutes, !event.time).replace(/ before$/, "").replace(/^/, "In ")}${time ? ` · ${time}` : ""}`;
  return { title: event.title || "Untitled event", body: when };
}

// ---- celebrations -------------------------------------------------------------------------

export interface Celebration {
  id: CelebrationId;
  name: string;
  icon: IconName;
  /** Accent for light and dark mode (used while the accent follows the sky). */
  accent: [light: string, dark: string];
  /** Mixed into the sky gradient (top, middle, bottom) and how strongly (0..1). */
  tint: [string, string, string];
  strength: number;
  /** The particles the apps draw. */
  effect: "fireworks" | "hearts" | "petals" | "bats" | "snow-lights" | "confetti-balloons" | "confetti";
}

export const CELEBRATIONS: Record<CelebrationId, Celebration> = {
  "new-year": { id: "new-year", name: "New Year", icon: "sparkles", accent: ["#b8860b", "#f5c95a"], tint: ["#0d0b2a", "#2a1f55", "#6b4b2a"], strength: 0.45, effect: "fireworks" },
  valentine: { id: "valentine", name: "Valentine's", icon: "heart", accent: ["#c8336a", "#ff8fb4"], tint: ["#6b1f4a", "#d0577f", "#ffc2d4"], strength: 0.38, effect: "hearts" },
  easter: { id: "easter", name: "Easter", icon: "egg", accent: ["#5f8f3a", "#b5e28a"], tint: ["#a7c7f2", "#f7d9ee", "#fff1c9"], strength: 0.32, effect: "petals" },
  halloween: { id: "halloween", name: "Halloween", icon: "ghost", accent: ["#d1650f", "#ff9b3d"], tint: ["#1a0e2e", "#4a1e4f", "#d1650f"], strength: 0.5, effect: "bats" },
  christmas: { id: "christmas", name: "Christmas", icon: "tree-pine", accent: ["#b3262e", "#ff7a7a"], tint: ["#0e2a3d", "#2d5a5a", "#e8d7c3"], strength: 0.34, effect: "snow-lights" },
  birthday: { id: "birthday", name: "Birthday", icon: "cake", accent: ["#8e44c4", "#d6a3ff"], tint: ["#3b2a7a", "#c46fb8", "#ffd39a"], strength: 0.36, effect: "confetti-balloons" },
  party: { id: "party", name: "Party", icon: "party-popper", accent: ["#c4366f", "#ff92c2"], tint: ["#2a2a7a", "#8a4fc4", "#ffb38a"], strength: 0.28, effect: "confetti" },
};
export const CELEBRATION_IDS = Object.keys(CELEBRATIONS) as CelebrationId[];

export interface ActiveCelebration {
  celebration: Celebration;
  /** "Merry Christmas!", "Happy birthday, Ada!", or the event's title. */
  greeting: string;
  event: CalendarEvent;
}

/**
 * The celebration for a moment, if any: your birthday first, then your own events marked to
 * celebrate (from their start time on the day), then holidays.
 */
export function celebrationAt(events: CalendarEvent[], now = Date.now()): ActiveCelebration | undefined {
  const date = today(now);
  const rank = (e: CalendarEvent) => (e.builtin === "birthday" ? 0 : e.builtin === "holiday" ? 2 : 1);
  const live = events
    .filter((e) => e.celebrate && CELEBRATIONS[e.celebrate] && occursOn(e, date) && (!e.time || at(date, e.time) <= now))
    .sort((a, b) => rank(a) - rank(b));
  const event = live[0];
  if (!event) return undefined;
  const greeting = event.builtin ? event.notes || event.title : event.title || CELEBRATIONS[event.celebrate!].name;
  return { celebration: CELEBRATIONS[event.celebrate!], greeting, event };
}
