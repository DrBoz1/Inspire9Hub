import { describe, expect, it } from "vitest";
import { HUB_TIMEZONE } from "@/lib/datetime";
import { wallClockToUtc } from "@/features/booking-map/zoned-time";
import {
  barPercent,
  bookingsCsv,
  csvCell,
  csvFilename,
  cancellations,
  dayWindow,
  formatCents,
  formatDollars,
  formatHours,
  formatPercent,
  heatExtremes,
  heatLevel,
  hourHeat,
  leadTimes,
  niceTicks,
  openMinutes,
  openWindows,
  percentChange,
  pointsChange,
  resolveRange,
  revenueSeries,
  roomStats,
  sellableMinutes,
  sparkPaths,
  summarise,
  toInsightBooking,
  toInsightBookings,
  topSpenders,
  windowsByDay,
  type RawInsightBooking,
} from "./admin-insights";

/** Melbourne wall clock -> ISO, for tests where the offset isn't the point. */
const mel = (day: string, clock: string) => {
  const [h, m] = clock.split(":").map(Number);
  return new Date(wallClockToUtc(day, h * 60 + m, HUB_TIMEZONE)).toISOString();
};

let seq = 0;
function raw(start: string, end: string, extra: Partial<RawInsightBooking> = {}): RawInsightBooking {
  seq += 1;
  return {
    id: `b${seq}`,
    workspace_id: "r1",
    member_id: "m1",
    start_date_time: start,
    end_date_time: end,
    booking_status: "confirmed",
    members: { full_name: "Alex Chen", company_name: "Northwind" },
    payments: [{ amount: 50, refunded_amount: null, payment_status: "paid" }],
    ...extra,
  };
}
const book = (...rows: RawInsightBooking[]) => toInsightBookings(rows);

// A plain week with no clock change: Monday 14 to Sunday 20 September 2026.
const WEEK = dayWindow("2026-09-14", "2026-09-20");

describe("daylight saving", () => {
  // Melbourne moves from UTC+10 to UTC+11 at 2am on Sunday 4 October 2026,
  // and back at 3am on Sunday 4 April 2027.
  it("measures the clock-change days as 23 and 25 hours long", () => {
    const spring = dayWindow("2026-10-04", "2026-10-04");
    expect(spring.startUTC).toBe("2026-10-03T14:00:00.000Z");
    expect(spring.endUTC).toBe("2026-10-04T13:00:00.000Z");
    expect((Date.parse(spring.endUTC) - Date.parse(spring.startUTC)) / 3_600_000).toBe(23);

    const autumn = dayWindow("2027-04-04", "2027-04-04");
    expect((Date.parse(autumn.endUTC) - Date.parse(autumn.startUTC)) / 3_600_000).toBe(25);
  });

  it("opens at 7am local on either side of the change", () => {
    const [saturday, monday] = openWindows("2026-10-03", "2026-10-05");
    // Saturday is still on +10, and opens at 9.
    expect(new Date(saturday.open).toISOString()).toBe("2026-10-02T23:00:00.000Z");
    // Monday is on +11. A fixed +10 offset would put this an hour late.
    expect(new Date(monday.open).toISOString()).toBe("2026-10-04T20:00:00.000Z");
  });

  it("counts a 7am booking the morning after the change, which a fixed offset would read as 6am and drop", () => {
    const windows = openWindows("2026-10-03", "2026-10-05");
    const [b] = book(raw("2026-10-04T20:00:00.000Z", "2026-10-04T21:00:00.000Z"));
    expect(openMinutes(b, windowsByDay(windows))).toBe(60);
  });

  it("sells no time on the closed Sunday the clocks change", () => {
    // Saturday 9-17 plus Monday 7-21; the Sunday adds nothing.
    expect(sellableMinutes(openWindows("2026-10-03", "2026-10-05"))).toBe(8 * 60 + 14 * 60);
  });
});

describe("booked time inside opening hours", () => {
  const lookup = windowsByDay(openWindows("2026-09-14", "2026-09-20"));

  it("clips a booking that starts before opening", () => {
    const [b] = book(raw(mel("2026-09-18", "06:00"), mel("2026-09-18", "08:00")));
    expect(openMinutes(b, lookup)).toBe(60);
  });

  it("splits a booking across midnight between the two days' hours", () => {
    // Friday closes at 21:00 and Saturday opens at 9:00: one hour counts on each side.
    const [b] = book(raw(mel("2026-09-18", "20:00"), mel("2026-09-19", "10:00")));
    expect(openMinutes(b, lookup)).toBe(120);
  });

  it("ignores time on a closed day entirely", () => {
    const [b] = book(raw(mel("2026-09-20", "10:00"), mel("2026-09-20", "12:00")));
    expect(openMinutes(b, lookup)).toBe(0);
  });
});

describe("headline numbers", () => {
  it("never divides by zero on a window with nothing to sell", () => {
    const sunday = dayWindow("2026-09-20", "2026-09-20");
    const s = summarise(book(raw(mel("2026-09-20", "10:00"), mel("2026-09-20", "12:00"))), sunday, 5);
    expect(s.capacityMinutes).toBe(0);
    expect(s.utilisation).toBeNull();

    const noRooms = summarise([], WEEK, 0);
    expect(noRooms.utilisation).toBeNull();
    expect(noRooms.averageMinutes).toBeNull();
  });

  it("measures utilisation against opening hours, not the 24-hour day", () => {
    // One room, one 2-hour booking, in a week with 5 x 14 h + 8 h = 78 sellable hours.
    const s = summarise(book(raw(mel("2026-09-15", "10:00"), mel("2026-09-15", "12:00"))), WEEK, 1);
    expect(s.capacityMinutes).toBe(78 * 60);
    expect(s.utilisation).toBeCloseTo(2 / 78, 6);
  });

  it("leaves cancelled bookings out of sold time but keeps what they paid", () => {
    const s = summarise(
      book(
        raw(mel("2026-09-15", "10:00"), mel("2026-09-15", "12:00")),
        // Cancelled with a 50% refund: no longer sold time, but $25 was kept.
        raw(mel("2026-09-16", "10:00"), mel("2026-09-16", "12:00"), {
          booking_status: "cancelled",
          payments: [{ amount: 50, refunded_amount: 25, payment_status: "refunded" }],
        }),
      ),
      WEEK,
      1,
    );
    expect(s.bookings).toBe(1);
    expect(s.bookedMinutes).toBe(120);
    expect(s.grossRevenue).toBe(100);
    expect(s.refunded).toBe(25);
    expect(s.netRevenue).toBe(75);
  });

  it("doesn't take a failed refund off revenue: the money never went back", () => {
    const s = summarise(
      book(raw(mel("2026-09-15", "10:00"), mel("2026-09-15", "11:00"), { booking_status: "cancelled", payments: [{ amount: 40, refunded_amount: null, payment_status: "refund_failed" }] })),
      WEEK,
      1,
    );
    expect(s.netRevenue).toBe(40);
    expect(s.refunded).toBe(0);
  });

  it("ignores checkout holds and counts each member once", () => {
    const s = summarise(
      book(
        raw(mel("2026-09-15", "10:00"), mel("2026-09-15", "11:00")),
        raw(mel("2026-09-16", "10:00"), mel("2026-09-16", "11:00")),
        raw(mel("2026-09-17", "10:00"), mel("2026-09-17", "11:00"), { booking_status: "pending", payments: [] }),
      ),
      WEEK,
      1,
    );
    expect(s.bookings).toBe(2);
    expect(s.members).toBe(1);
    expect(s.averageMinutes).toBe(60);
  });

  it("assigns a booking to the window its start falls in", () => {
    const before = raw(mel("2026-09-13", "10:00"), mel("2026-09-13", "11:00"));
    const after = raw(mel("2026-09-21", "10:00"), mel("2026-09-21", "11:00"));
    expect(summarise(book(before, after), WEEK, 1).bookings).toBe(0);
  });
});

describe("rooms", () => {
  const rooms = [
    { id: "r1", name: "Dream Room", sellable: true },
    { id: "r2", name: "Elbow Room", sellable: true },
    { id: "r3", name: "Old Loft", sellable: false },
    { id: "r4", name: "Closed Annexe", sellable: false },
  ];

  it("ranks the busiest first and keeps retired rooms only if they took bookings", () => {
    const stats = roomStats(
      rooms,
      book(
        raw(mel("2026-09-15", "10:00"), mel("2026-09-15", "11:00"), { workspace_id: "r1" }),
        raw(mel("2026-09-15", "10:00"), mel("2026-09-15", "13:00"), { workspace_id: "r2" }),
        raw(mel("2026-09-16", "10:00"), mel("2026-09-16", "11:00"), { workspace_id: "r3" }),
      ),
      WEEK,
    );
    expect(stats.map((r) => r.name)).toEqual(["Elbow Room", "Dream Room", "Old Loft"]);
    expect(stats[0].utilisation).toBeCloseTo(3 / 78, 6);
    // A retired room has no sellable time, so its utilisation is unknown rather than a made-up percentage.
    expect(stats[2].utilisation).toBeNull();
  });

  it("still lists an idle room, at zero", () => {
    const stats = roomStats(rooms.slice(0, 2), [], WEEK);
    expect(stats.map((r) => [r.name, r.utilisation])).toEqual([
      ["Dream Room", 0],
      ["Elbow Room", 0],
    ]);
  });
});

describe("top spenders", () => {
  it("adds up each member's net spend, biggest first, and drops anyone fully refunded", () => {
    const spenders = topSpenders(
      book(
        raw(mel("2026-09-15", "10:00"), mel("2026-09-15", "11:00"), { member_id: "m1" }),
        raw(mel("2026-09-16", "10:00"), mel("2026-09-16", "11:00"), { member_id: "m1" }),
        raw(mel("2026-09-15", "12:00"), mel("2026-09-15", "13:00"), { member_id: "m2", members: { full_name: "Sam Taylor" }, payments: [{ amount: 80, refunded_amount: null, payment_status: "paid" }] }),
        raw(mel("2026-09-15", "14:00"), mel("2026-09-15", "15:00"), { member_id: "m3", members: { full_name: "Priya Nair" }, booking_status: "cancelled", payments: [{ amount: 60, refunded_amount: 60, payment_status: "refunded" }] }),
      ),
      WEEK,
    );
    expect(spenders.map((s) => [s.name, s.net, s.bookings])).toEqual([
      ["Alex Chen", 100, 2],
      ["Sam Taylor", 80, 1],
    ]);
  });

  it("honours the limit", () => {
    const many = Array.from({ length: 8 }, (_, i) => raw(mel("2026-09-15", "10:00"), mel("2026-09-15", "11:00"), { member_id: `m${i}` }));
    expect(topSpenders(book(...many), WEEK, 3)).toHaveLength(3);
  });
});

describe("revenue over time", () => {
  it("uses one point a day for a month and one a week beyond that", () => {
    const now = new Date("2026-09-18T02:00:00Z");
    expect(revenueSeries([], resolveRange("30d", now)).points).toHaveLength(30);
    const quarter = revenueSeries([], resolveRange("90d", now));
    expect(quarter.bucketDays).toBe(7);
    expect(quarter.points).toHaveLength(13);
  });

  it("puts revenue on the Melbourne day of the booking", () => {
    // 8:30am Melbourne on the 15th is still the 14th in UTC.
    const { points } = revenueSeries(book(raw(mel("2026-09-15", "08:30"), mel("2026-09-15", "09:30"))), WEEK);
    expect(points.map((p) => p.value)).toEqual([0, 50, 0, 0, 0, 0, 0]);
    expect(points[1].label).toBe("15 Sep");
  });
});

describe("when the space is busy", () => {
  it("marks closed hours as closed rather than quiet, and leaves Sunday out", () => {
    const grid = hourHeat([], WEEK, 1);
    expect(grid.rows.map((r) => r.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    const saturday = grid.rows[5];
    // Saturday opens at 9, so the 7am column is closed...
    expect(saturday.cells[grid.hours.indexOf(7)]).toEqual({ state: "closed" });
    // ...while an empty weekday hour is open and at zero.
    expect(grid.rows[0].cells[grid.hours.indexOf(7)]).toEqual({ state: "open", occupancy: 0, minutes: 0 });
  });

  it("works out how full an hour ran across all the rooms", () => {
    // Two rooms; one is booked for the whole of Tuesday 10-11am.
    const grid = hourHeat(book(raw(mel("2026-09-15", "10:00"), mel("2026-09-15", "11:00"))), WEEK, 2);
    const tuesday = grid.rows[1];
    expect(tuesday.cells[grid.hours.indexOf(10)]).toEqual({ state: "open", occupancy: 0.5, minutes: 60 });
    expect(tuesday.cells[grid.hours.indexOf(11)]).toEqual({ state: "open", occupancy: 0, minutes: 0 });
  });

  it("says a weekday has no data when the window doesn't include one", () => {
    const monday = dayWindow("2026-09-14", "2026-09-14");
    expect(hourHeat([], monday, 1).rows[1].cells[5]).toEqual({ state: "none" });
  });
});

describe("booking behaviour", () => {
  it("buckets how far ahead people book, and counts unrecorded ones as unknown", () => {
    const start = mel("2026-09-18", "10:00");
    const { buckets, known, unknown } = leadTimes(
      book(
        raw(start, mel("2026-09-18", "11:00"), { created_at: mel("2026-09-18", "08:00") }),
        raw(start, mel("2026-09-18", "11:00"), { created_at: mel("2026-09-16", "08:00") }),
        raw(start, mel("2026-09-18", "11:00"), { created_at: mel("2026-09-01", "08:00") }),
        raw(start, mel("2026-09-18", "11:00"), { created_at: null }),
      ),
      WEEK,
    );
    expect(buckets.map((b) => b.count)).toEqual([1, 1, 0, 1]);
    expect([known, unknown]).toEqual([3, 1]);
  });

  it("doesn't count an abandoned checkout as a cancellation", () => {
    const stats = cancellations(
      book(
        raw(mel("2026-09-15", "10:00"), mel("2026-09-15", "11:00")),
        raw(mel("2026-09-16", "10:00"), mel("2026-09-16", "11:00"), { booking_status: "cancelled", payments: [{ amount: 50, refunded_amount: 50, payment_status: "refunded" }] }),
        // Never paid: the checkout was closed or expired.
        raw(mel("2026-09-17", "10:00"), mel("2026-09-17", "11:00"), { booking_status: "cancelled", payments: [] }),
      ),
      WEEK,
    );
    expect(stats.paid).toBe(2);
    expect(stats.cancelled).toBe(1);
    expect(stats.rate).toBe(0.5);
    expect(stats.abandoned).toBe(1);
    expect(stats.abandonRate).toBeCloseTo(1 / 3, 6);
  });

  it("groups cancellation notice by the refund policy's bands", () => {
    const start = mel("2026-09-18", "12:00");
    const cancelled = (hoursAhead: number | null) =>
      raw(start, mel("2026-09-18", "13:00"), {
        booking_status: "cancelled",
        cancelled_at: hoursAhead === null ? null : new Date(Date.parse(start) - hoursAhead * 3_600_000).toISOString(),
      });
    const { notice, noticeUnknown } = cancellations(book(cancelled(72), cancelled(48), cancelled(10), cancelled(2), cancelled(null)), WEEK);
    expect(notice.map((b) => [b.label, b.count])).toEqual([
      ["48 h or more ahead", 2],
      ["4–48 h ahead", 1],
      ["Under 4 h", 1],
    ]);
    expect(noticeUnknown).toBe(1);
  });

  it("has no rates at all rather than 0% when nothing happened", () => {
    const stats = cancellations([], WEEK);
    expect([stats.rate, stats.abandonRate]).toEqual([null, null]);
  });
});

describe("ranges", () => {
  const now = new Date("2026-09-18T02:00:00Z"); // midday Friday in Melbourne

  it("ends today in Melbourne, even when UTC is still on yesterday", () => {
    // 1:30am Melbourne on the 18th is 3:30pm on the 17th in UTC.
    expect(resolveRange("7d", new Date("2026-09-17T15:30:00Z")).endKey).toBe("2026-09-18");
  });

  it("builds rolling windows with an equal, adjacent previous period", () => {
    const r = resolveRange("30d", now);
    expect([r.startKey, r.endKey, r.days]).toEqual(["2026-08-20", "2026-09-18", 30]);
    expect([r.previous.startKey, r.previous.endKey]).toEqual(["2026-07-21", "2026-08-19"]);
    expect(r.startUTC).toBe("2026-08-19T14:00:00.000Z");
  });

  it("handles calendar months", () => {
    expect(resolveRange("month", now)).toMatchObject({ startKey: "2026-09-01", endKey: "2026-09-18", days: 18 });
    const last = resolveRange("last-month", now);
    expect([last.startKey, last.endKey, last.days]).toEqual(["2026-08-01", "2026-08-31", 31]);
    expect([last.previous.startKey, last.previous.endKey]).toEqual(["2026-07-01", "2026-07-31"]);
  });

  it("falls back to 30 days for anything it doesn't recognise, like a hand-edited URL", () => {
    expect(resolveRange("forever", now).key).toBe("30d");
    expect(resolveRange(undefined, now).key).toBe("30d");
  });
});

describe("rows", () => {
  it("drops a row whose times can't be read or run backwards", () => {
    expect(toInsightBooking(raw("not a date", mel("2026-09-15", "11:00")))).toBeNull();
    expect(toInsightBooking(raw(mel("2026-09-15", "11:00"), mel("2026-09-15", "10:00")))).toBeNull();
  });

  it("reads embedded relations whether Supabase returns an object or an array", () => {
    const b = toInsightBooking(
      raw(mel("2026-09-15", "10:00"), mel("2026-09-15", "11:00"), {
        booking_status: " Confirmed ",
        members: [{ full_name: "  " }],
        payments: { amount: 30, refunded_amount: null, payment_status: "paid" },
      }),
    )!;
    expect([b.status, b.member, b.net, b.hasPayment]).toEqual(["confirmed", "Member", 30, true]);
  });
});

describe("chart geometry and formatting", () => {
  it("never produces NaN geometry", () => {
    expect(barPercent(5, 0)).toBe(0);
    expect(barPercent(50, 200)).toBe(25);
    expect(sparkPaths([], 100, 40).line).toBe("");
    expect(sparkPaths([7], 100, 40).points).toEqual([{ x: 50, y: 0 }]);
    const flat = sparkPaths([0, 0, 0], 100, 40);
    expect(flat.line).toBe("M0 40 L50 40 L100 40");
    expect(flat.area).not.toContain("NaN");
  });

  it("picks round axis ticks that always clear the peak", () => {
    expect(niceTicks(437)).toEqual({ top: 600, ticks: [0, 200, 400, 600] });
    expect(niceTicks(1000)).toEqual({ top: 1000, ticks: [0, 500, 1000] });
    expect(niceTicks(1001).top).toBeGreaterThanOrEqual(1001);
    expect(niceTicks(0)).toEqual({ top: 1, ticks: [0] });
    for (const peak of [3, 17, 99, 250, 1234, 98765]) {
      const { top, ticks } = niceTicks(peak);
      expect(top).toBeGreaterThanOrEqual(peak);
      expect(ticks[ticks.length - 1]).toBe(top);
    }
  });

  it("draws the line against the axis top, not the data peak", () => {
    // Peak 50 on an axis that tops out at 100 sits halfway up, not at the top.
    expect(sparkPaths([0, 50], 100, 40, 100).points[1]).toEqual({ x: 100, y: 20 });
  });

  it("finds the busiest hour and counts the idle ones", () => {
    const grid = hourHeat(book(raw(mel("2026-09-15", "10:00"), mel("2026-09-15", "11:00"))), WEEK, 2);
    const { busiest, idleHours, openHours } = heatExtremes(grid);
    expect(busiest).toEqual({ label: "Tue", hour: 10, occupancy: 0.5 });
    // Five weekdays of 14 open hours plus Saturday's 8, all idle but one.
    expect(openHours).toBe(5 * 14 + 8);
    expect(idleHours).toBe(openHours - 1);
    expect(heatExtremes(hourHeat([], WEEK, 1)).busiest).toBeNull();
  });

  it("shades the heatmap in five steps", () => {
    expect([0, 0.1, 0.3, 0.5, 0.9].map(heatLevel)).toEqual([0, 1, 2, 3, 4]);
  });

  it("formats money, hours and shares consistently", () => {
    expect(formatDollars(1234.6)).toBe("$1,235");
    expect(formatDollars(-12)).toBe("-$12");
    expect(formatCents(1234.5)).toBe("$1,234.50");
    expect(formatHours(90)).toBe("1.5 h");
    expect(formatHours(0)).toBe("0 h");
    expect(formatHours(60 * 1234)).toBe("1,234 h");
    expect(formatPercent(0.004)).toBe("<1%");
    expect(formatPercent(0.425)).toBe("43%");
    expect(formatPercent(null)).toBe("—");
  });

  it("compares periods without inventing a change from nothing", () => {
    expect(percentChange(120, 100)).toEqual({ direction: "up", label: "+20%" });
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(100, 100)).toEqual({ direction: "flat", label: "No change" });
    // A rate moving 10% -> 15% is five points, not "+50%".
    expect(pointsChange(0.15, 0.1)).toEqual({ direction: "up", label: "+5 pts" });
    expect(pointsChange(null, 0.1)).toBeNull();
  });
});

describe("CSV export", () => {
  it("quotes cells the way spreadsheets expect", () => {
    expect(csvCell("Dream Room")).toBe("Dream Room");
    expect(csvCell("Smith, Jones & Co")).toBe("\"Smith, Jones & Co\"");
    expect(csvCell("The \"Loft\"")).toBe("\"The \"\"Loft\"\"\"");
    expect(csvCell(null)).toBe("");
    expect(csvCell(12.5)).toBe("12.5");
  });

  it("stops a member-typed name from running as a formula when an admin opens the file", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+61 400 000 000")).toBe("'+61 400 000 000");
    expect(csvCell("@admin")).toBe("'@admin");
    // Our own numbers are never touched, even negative ones.
    expect(csvCell(-12)).toBe("-12");
  });

  it("writes every booking in Melbourne time, abandoned checkouts included and labelled", () => {
    const rooms = [{ id: "r1", name: "Dream Room", sellable: true }];
    const csv = bookingsCsv(
      book(
        raw(mel("2026-09-16", "14:00"), mel("2026-09-16", "15:30"), { created_at: mel("2026-09-10", "09:05") }),
        // 8:30am Melbourne is still the previous day in UTC; the row must say the 15th.
        raw(mel("2026-09-15", "08:30"), mel("2026-09-15", "09:30"), { booking_status: "cancelled", payments: [] }),
        raw(mel("2026-09-25", "10:00"), mel("2026-09-25", "11:00")),
      ),
      WEEK,
      rooms,
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe("Date,Start,End,Hours,Space,Member,Company,Status,Paid,Refunded,Net,Booked on,Cancelled on");
    expect(lines).toHaveLength(3); // the booking after the window is left out
    expect(lines[1]).toBe("2026-09-15,08:30,09:30,1,Dream Room,Alex Chen,Northwind,Checkout abandoned,0,0,0,,");
    expect(lines[2]).toBe("2026-09-16,14:00,15:30,1.5,Dream Room,Alex Chen,Northwind,Confirmed,50,0,50,2026-09-10 09:05,");
  });

  it("names the file after the window and the room", () => {
    expect(csvFilename(WEEK)).toBe("inspire9-bookings-2026-09-14-to-2026-09-20.csv");
    expect(csvFilename(WEEK, "The Boiler Room!")).toBe("inspire9-bookings-the-boiler-room-2026-09-14-to-2026-09-20.csv");
  });
});
