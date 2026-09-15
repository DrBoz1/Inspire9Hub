import { describe, expect, it } from "vitest";
import {
  bookingPhase,
  dashboardSummary,
  dateTile,
  formatBooked,
  formatLongDay,
  formatRange,
  greetingFor,
  hubDateKey,
  oldestWaitingHint,
  roomTimelines,
  sortPending,
  startsIn,
  toDashBooking,
  toDashPending,
  todayOverview,
  waitingDays,
  waitingLabel,
  type DashBooking,
} from "./admin-dashboard";

// Tuesday 15 September 2026 in Melbourne (AEST, UTC+10).
const melb = (hhmm: string, day = 15) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2026, 8, day, h - 10, m));
};
const NOW = melb("14:30");
const booking = (id: string, room: string, from: string, to: string, status = "confirmed", day = 15): DashBooking => ({
  id, workspaceId: room, room, member: "Alex Chen", status, start: melb(from, day).toISOString(), end: melb(to, day).toISOString(),
});

describe("Melbourne time, whatever the server's zone", () => {
  it("greets by the hub's clock", () => {
    expect(greetingFor(melb("08:30"))).toBe("Good morning");
    expect(greetingFor(melb("13:00"))).toBe("Good afternoon");
    expect(greetingFor(melb("18:40"))).toBe("Good evening");
  });

  it("formats times, days and date tiles", () => {
    expect(formatRange(melb("09:00").toISOString(), melb("11:30").toISOString())).toBe("9:00 am – 11:30 am");
    expect(formatRange(melb("12:00").toISOString(), melb("00:15", 16).toISOString())).toBe("12:00 pm – 12:15 am");
    expect(formatLongDay(NOW)).toBe("Tuesday 15 September");
    expect(dateTile(melb("09:00", 16).toISOString())).toMatchObject({ weekday: "Wed", day: "16" });
  });

  it("knows it's already tomorrow in Melbourne while UTC is still today", () => {
    expect(hubDateKey(new Date("2026-09-15T15:30:00Z"))).toBe("2026-09-16");
  });

  it("follows daylight saving", () => {
    // 1 December is AEDT, UTC+11: 22:00 UTC is 9am the next day.
    expect(greetingFor(new Date("2026-11-30T22:00:00Z"))).toBe("Good morning");
    expect(hubDateKey(new Date("2026-11-30T22:00:00Z"))).toBe("2026-12-01");
  });
});

describe("today's bookings", () => {
  const today = [
    booking("a", "dream", "09:00", "11:00"),
    booking("b", "dream", "14:00", "16:00"),
    booking("c", "elbow", "14:00", "15:30"),
    booking("d", "green", "15:00", "17:00", "pending"),
    booking("e", "boiler", "17:30", "19:00"),
  ];

  it("works out each booking's phase", () => {
    expect(today.map((b) => bookingPhase(b, NOW))).toEqual(["finished", "in_use", "in_use", "upcoming", "upcoming"]);
  });

  it("counts confirmed bookings only", () => {
    expect(todayOverview(today, NOW)).toEqual({ total: 4, inUse: 2, toCome: 1, roomsInUse: 2 });
  });

  it("says when something starts", () => {
    expect(startsIn(melb("14:45").toISOString(), NOW)).toBe("In 15 min");
    expect(startsIn(melb("17:30").toISOString(), NOW)).toBe("In 3 h");
    expect(startsIn(melb("16:00").toISOString(), NOW)).toBe("In 1.5 h");
  });

  it("writes a plain summary", () => {
    expect(dashboardSummary(3, 7, 2)).toBe("3 inductions to review, 7 bookings today and 2 rooms in use right now.");
    expect(dashboardSummary(1, 1, 0)).toBe("1 induction to review and 1 booking today.");
    expect(dashboardSummary(0, 0, 0)).toBe("No inductions to review and no bookings today.");
  });
});

describe("room timeline", () => {
  const rooms = [{ id: "boiler", name: "Boiler Room" }, { id: "dream", name: "Dream Room" }, { id: "phone", name: "Phone Booth" }];

  it("places bookings on the 7am–9pm track", () => {
    const { rows } = roomTimelines(rooms, [booking("a", "dream", "09:00", "11:00")], NOW);
    // 9am is 2 hours into a 14 hour window.
    expect(rows[0].segments[0]).toMatchObject({ left: 14.29, width: 14.29, phase: "finished" });
    expect(rows[0].bookedMinutes).toBe(120);
  });

  it("puts rooms with bookings first, then by name", () => {
    const { rows } = roomTimelines(rooms, [booking("a", "dream", "09:00", "11:00")], NOW);
    expect(rows.map((r) => r.name)).toEqual(["Dream Room", "Boiler Room", "Phone Booth"]);
  });

  it("clips a booking that started yesterday, and leaves unpaid ones out of the hours", () => {
    const overnight = { ...booking("x", "boiler", "22:00", "23:59", "confirmed", 14), end: melb("08:00").toISOString() };
    const { rows } = roomTimelines(rooms, [overnight, booking("p", "boiler", "10:00", "11:00", "pending")], NOW);
    const boiler = rows.find((r) => r.id === "boiler")!;
    expect(boiler.segments[0]).toMatchObject({ left: 0, width: 7.14 });
    expect(boiler.bookedMinutes).toBe(480);
  });

  it("marks now, and only within the day", () => {
    expect(roomTimelines(rooms, [], NOW).nowPct).toBe(53.57);
    expect(roomTimelines(rooms, [], melb("22:30")).nowPct).toBeNull();
  });

  it("caps the list", () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ id: `r${i}`, name: `Room ${i}` }));
    expect(roomTimelines(many, [], NOW, 8)).toMatchObject({ hidden: 3 });
  });

  it("formats booked time", () => {
    expect([0, 45, 60, 150].map(formatBooked)).toEqual(["Free", "45 min", "1 h", "2.5 h"]);
  });
});

describe("inductions waiting", () => {
  it("counts days, across months", () => {
    expect(waitingDays("2026-08-30", "2026-09-02")).toBe(3);
    expect(waitingDays(null, "2026-09-02")).toBeNull();
    expect([0, 1, 4, null].map(waitingLabel)).toEqual(["Today", "1 day", "4 days", "Waiting"]);
  });

  it("puts the longest wait first and describes it", () => {
    const sorted = sortPending([
      { id: "1", name: "Jordan", company: null, submittedOn: "2026-09-15" },
      { id: "2", name: "Chris", company: null, submittedOn: null },
      { id: "3", name: "Sam", company: null, submittedOn: "2026-09-11" },
    ]);
    expect(sorted.map((p) => p.name)).toEqual(["Sam", "Jordan", "Chris"]);
    expect(oldestWaitingHint(sorted, "2026-09-15")).toBe("Oldest waiting 4 days");
    expect(oldestWaitingHint([], "2026-09-15")).toBe("All caught up");
  });
});

describe("reading Supabase rows", () => {
  it("accepts embedded relations as objects or arrays", () => {
    const base = { id: "b1", workspace_id: "w1", start_date_time: "s", end_date_time: "e", booking_status: "confirmed" };
    expect(toDashBooking({ ...base, workspaces: { name: "Dream Room" }, members: [{ full_name: " Alex " }] })).toMatchObject({ room: "Dream Room", member: "Alex" });
    expect(toDashBooking({ ...base, workspaces: null, members: null })).toMatchObject({ room: "Room", member: "Member" });
    expect(toDashPending({ id: "m1", full_name: "Sam", company_name: " ", induction_records: [{ completion_date: "2026-09-11" }] }))
      .toEqual({ id: "m1", name: "Sam", company: null, submittedOn: "2026-09-11" });
  });
});
