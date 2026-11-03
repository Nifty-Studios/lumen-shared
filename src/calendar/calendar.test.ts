import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { at, birthdayEvent, celebrationAt, easter, holidayEvents, occurrences, occursOn, remindersBetween, type CalendarEvent } from "./index";
import { themeFor, computeSky } from "../ambient";
import { CELEBRATIONS } from "./index";
import { meta } from "../schema/client";
import { createLumen } from "../client";
import { nodeDriver } from "../client/test-driver";

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: "e",
  spaceId: "s",
  title: "Test",
  date: "2026-01-31",
  time: null,
  endTime: null,
  repeat: "none",
  until: null,
  reminders: [],
  sticker: "star",
  notes: "",
  celebrate: null,
  ...over,
});

describe("repeats", () => {
  it("follows each rule, including short months and leap days", () => {
    const monthly = ev({ repeat: "monthly" });
    expect(occursOn(monthly, "2026-02-28")).toBe(false);
    expect(occursOn(monthly, "2026-03-31")).toBe(true);
    expect(occursOn(ev({ repeat: "weekly", date: "2026-11-02" }), "2026-11-16")).toBe(true);
    expect(occursOn(ev({ repeat: "weekly", date: "2026-11-02" }), "2026-11-17")).toBe(false);
    expect(occursOn(ev({ repeat: "daily", until: "2026-02-02" }), "2026-02-03")).toBe(false);
    expect(occursOn(ev({ repeat: "daily" }), "2026-01-30")).toBe(false);
    const leap = ev({ repeat: "yearly", date: "2000-02-29" });
    expect(occursOn(leap, "2027-02-28")).toBe(true);
    expect(occursOn(leap, "2028-02-29")).toBe(true);
    expect(occursOn(leap, "2028-02-28")).toBe(false);
  });

  it("expands occurrences in order", () => {
    const list = occurrences([ev({ id: "a", repeat: "daily", time: "09:00" }), ev({ id: "b", date: "2026-02-01" })], "2026-01-31", "2026-02-01");
    expect(list.map((o) => `${o.event.id}@${o.date}`)).toEqual(["a@2026-01-31", "b@2026-02-01", "a@2026-02-01"]);
  });
});

describe("special days", () => {
  it("knows Easter", () => {
    expect(easter(2026)).toBe("2026-04-05");
    expect(easter(2027)).toBe("2027-03-28");
    expect(easter(2025)).toBe("2025-04-20");
  });

  it("lists holidays in a range", () => {
    expect(holidayEvents("2026-12-01", "2027-01-02").map((e) => e.title)).toEqual(["Christmas Eve", "Christmas Day", "New Year's Eve", "New Year's Day"]);
  });

  it("puts the birthday first, then your events, then holidays", () => {
    const xmas = holidayEvents("2026-12-25", "2026-12-25");
    const party = ev({ id: "p", date: "2026-12-25", time: "20:00", celebrate: "party", title: "Office party" });
    expect(celebrationAt([...xmas, party], at("2026-12-25", "10:00"))?.celebration.id).toBe("christmas");
    expect(celebrationAt([...xmas, party], at("2026-12-25", "20:30"))?.greeting).toBe("Office party");
    const bday = birthdayEvent("1990-12-25", "Ada Lovelace");
    const now = at("2026-12-25", "08:00");
    expect(celebrationAt([...xmas, party, bday], now)?.greeting).toBe("Happy birthday, Ada!");
    expect(celebrationAt(xmas, at("2026-12-26", "08:00"))).toBeUndefined();
  });

  it("tints the sky and the accent", () => {
    const sky = computeSky({ now: at("2026-12-25", "12:00"), envTime: "day", envWeather: "clear" });
    const plain = themeFor(sky, false);
    const xmas = themeFor(sky, false, null, CELEBRATIONS.christmas);
    expect(xmas.accent).toBe(CELEBRATIONS.christmas.accent[0]);
    expect(xmas.skyTop).not.toBe(plain.skyTop);
    expect(themeFor(sky, false, "#2f9e5b", CELEBRATIONS.christmas).accent).not.toBe(CELEBRATIONS.christmas.accent[0]);
  });
});

describe("reminders", () => {
  it("fires each offset once, inside the window", () => {
    const meeting = ev({ id: "m", date: "2026-11-05", time: "14:00", reminders: [0, 15, 1440] });
    const from = at("2026-11-04", "00:00");
    const to = at("2026-11-06", "00:00");
    const list = remindersBetween([meeting], from, to);
    expect(list.map((r) => r.key)).toEqual(["m:2026-11-05:1440", "m:2026-11-05:15", "m:2026-11-05:0"]);
    expect(list[1]!.body).toBe("In 15 minutes · 14:00");
    expect(list[2]!.body).toBe("Now · 14:00");
    // The window is (from, to]: a reminder exactly at `from` was already told.
    expect(remindersBetween([meeting], at("2026-11-05", "14:00"), to)).toEqual([]);
  });

  it("counts all-day reminders from 9:00", () => {
    const trip = ev({ id: "t", date: "2026-11-10", reminders: [0, 1440] });
    const list = remindersBetween([trip], at("2026-11-01", "00:00"), at("2026-11-11", "00:00"));
    expect(list.map((r) => [new Date(r.at).getDate(), new Date(r.at).getHours(), r.body])).toEqual([
      [9, 9, "Tomorrow"],
      [10, 9, "Today"],
    ]);
  });
});

describe("calendar client", () => {
  it("stores events as synced blocks, edits them field by field, and adds the built-in days", async () => {
    const lumen = createLumen(nodeDriver());
    await lumen.start();
    await lumen.continueSignedOut();
    const space = (await lumen.getSpace())!;
    const id = await lumen.calendar.createEvent(space.id, { title: "Dentist", date: "2026-11-05", time: "14:00", sticker: "health" });
    const e = (await lumen.calendar.getEvent(id))!;
    expect(e).toMatchObject({ title: "Dentist", date: "2026-11-05", time: "14:00", sticker: "health", reminders: [10], editable: true });
    await lumen.calendar.updateEvent(id, { reminders: [60, 0], repeat: "weekly" });
    expect(await lumen.calendar.getEvent(id)).toMatchObject({ reminders: [0, 60], repeat: "weekly", title: "Dentist" });
    // Not a page: never in the sidebar.
    expect((await lumen.pageTree(space)).some((n) => n.page.id === id)).toBe(false);

    const dec = await lumen.calendar.between("2026-12-24", "2026-12-25");
    expect(dec.filter((o) => o.event.builtin).map((o) => o.event.title)).toEqual(["Christmas Eve", "Christmas Day"]);
    await lumen.updateSettings({ holidays: false });
    expect((await lumen.calendar.between("2026-12-24", "2026-12-25")).map((o) => o.event.title)).toEqual(["Dentist"]);

    await lumen.profile.setBirthday("03-14");
    expect((await lumen.calendar.between("2027-03-14", "2027-03-14")).map((o) => o.event.id)).toEqual(["birthday"]);
    expect((await lumen.calendar.celebration(at("2027-03-14", "12:00")))?.celebration.id).toBe("birthday");
    await lumen.updateSettings({ celebrations: false });
    expect(await lumen.calendar.celebration(at("2027-03-14", "12:00"))).toBeUndefined();

    await lumen.calendar.deleteEvent(id);
    expect(await lumen.calendar.getEvent(id)).toBeUndefined();
  });

  it("keeps the what's new card closed even when the dismissal isn't awaited", async () => {
    const lumen = createLumen(nodeDriver());
    await lumen.start();
    await lumen.continueSignedOut();
    await lumen.db.delete(meta).where(eq(meta.key, "whats_new"));
    expect((await lumen.whatsNew("1.3.0"))?.version).toBe("1.3.0");
    void lumen.dismissWhatsNew("1.3.0");
    await new Promise((r) => setTimeout(r, 30));
    expect(await lumen.whatsNew("1.3.0")).toBeUndefined();
  });
});
