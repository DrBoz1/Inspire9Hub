import { describe, expect, it } from "vitest";
import {
  announcementCounts,
  announcementState,
  dateKeyLabel,
  endDateKey,
  endLabel,
  endOfHubDay,
  endPresets,
  noticeboard,
  notExpiredFilter,
  postedLabel,
  sortAnnouncements,
  toAnnouncement,
  validateAnnouncement,
  type Announcement,
} from "./admin-announcements";

// Tuesday 15 September, midday in Melbourne.
const NOW = new Date("2026-09-15T02:00:00.000Z");
const item = (o: Partial<Announcement> = {}): Announcement => ({
  id: "a1", title: "Lift maintenance", message: "Friday morning", type: "maintenance", status: "active",
  createdAt: "2026-09-10T01:00:00.000Z", expiresAt: null, ...o,
});

describe("reading announcements", () => {
  it("fills in sensible defaults", () => {
    expect(toAnnouncement({ id: "a1", title: "  ", message: null, type: "party", status: "weird", created_at: "2026-09-10T01:00:00+00:00" }))
      .toEqual({ id: "a1", title: "Untitled announcement", message: "", type: "general", status: "active", createdAt: "2026-09-10T01:00:00+00:00", expiresAt: null });
  });

  it("puts the newest first, whatever the timestamp format", () => {
    const list = [item({ id: "old", createdAt: "2026-09-01T00:00:00+00:00" }), item({ id: "new", createdAt: "2026-09-12T00:00:00.000Z" })];
    expect(sortAnnouncements(list).map((a) => a.id)).toEqual(["new", "old"]);
  });
});

describe("states", () => {
  it("works out ended from the end date", () => {
    expect(announcementState(item(), NOW)).toBe("live");
    expect(announcementState(item({ expiresAt: "2026-09-15T13:59:59.999Z" }), NOW)).toBe("live");
    expect(announcementState(item({ expiresAt: "2026-06-23T00:00:00+00:00" }), NOW)).toBe("ended");
    expect(announcementState(item({ status: "archived" }), NOW)).toBe("archived");
  });

  it("counts each filter", () => {
    const list = [item(), item({ expiresAt: "2026-06-23T00:00:00+00:00" }), item({ status: "archived" }), item()];
    expect(announcementCounts(list, NOW)).toEqual({ live: 2, ended: 1, archived: 1, all: 4 });
  });

  it("shows members only the newest five live ones", () => {
    const list = Array.from({ length: 7 }, (_, i) => item({ id: `a${i}`, createdAt: `2026-09-0${i + 1}T01:00:00.000Z` }));
    list.push(item({ id: "archived", status: "archived", createdAt: "2026-09-14T00:00:00.000Z" }));
    expect(noticeboard(list, NOW).map((a) => a.id)).toEqual(["a6", "a5", "a4", "a3", "a2"]);
  });

  it("filters out ended ones on the member dashboard", () => {
    expect(notExpiredFilter(NOW)).toBe('expires_at.is.null,expires_at.gt."2026-09-15T02:00:00.000Z"');
  });
});

describe("end dates", () => {
  it("run to 11:59 pm in Melbourne, either side of daylight saving", () => {
    expect(endOfHubDay("2026-06-23")).toBe("2026-06-23T13:59:59.999Z");
    expect(endOfHubDay("2026-12-24")).toBe("2026-12-24T12:59:59.999Z");
    expect(endOfHubDay("2026-10-04")).toBe("2026-10-04T12:59:59.999Z"); // clocks go forward that morning
    expect(endOfHubDay("2026-04-05")).toBe("2026-04-05T13:59:59.999Z"); // and back
  });

  it("rejects dates that don't exist", () => {
    expect(endOfHubDay("2026-02-31")).toBeNull();
    expect(endOfHubDay("soon")).toBeNull();
  });

  it("read back as Melbourne days, old midnight-UTC ones included", () => {
    expect(endDateKey("2026-06-23T13:59:59.999Z")).toBe("2026-06-23");
    expect(endDateKey("2026-06-23T00:00:00+00:00")).toBe("2026-06-23");
  });

  it("offers quick picks across month ends", () => {
    expect(endPresets("2026-09-28").map((p) => p.value)).toEqual(["", "2026-09-28", "2026-09-29", "2026-10-05"]);
  });

  it("are labelled in plain words", () => {
    expect(dateKeyLabel("2026-09-18")).toBe("Friday 18 September");
    expect(endLabel(item({ expiresAt: "2026-06-23T00:00:00+00:00" }), NOW)).toBe("Ended Tue 23 Jun");
    expect(endLabel(item({ expiresAt: "2027-01-02T12:59:59.999Z" }), NOW)).toBe("Ends Sat 2 Jan 2027");
    expect(endLabel(item(), NOW)).toBe("No end date");
    expect(postedLabel(item(), NOW)).toBe("Posted Thu 10 Sep");
  });
});

describe("checking the form", () => {
  const today = "2026-09-15";

  it("tidies and accepts a good announcement", () => {
    expect(validateAnnouncement({ title: "  Lift   maintenance ", message: "Line one\r\nLine two  ", type: "maintenance", endsOn: "2026-09-18" }, today))
      .toEqual({ values: { title: "Lift maintenance", message: "Line one\nLine two", type: "maintenance", expires_at: "2026-09-18T13:59:59.999Z" } });
    expect(validateAnnouncement({ title: "Hi", message: "There", type: "general", endsOn: today }, today))
      .toEqual({ values: { title: "Hi", message: "There", type: "general", expires_at: "2026-09-15T13:59:59.999Z" } });
    expect(validateAnnouncement({ title: "Hi", message: "There", type: "general", endsOn: "" }, today))
      .toEqual({ values: { title: "Hi", message: "There", type: "general", expires_at: null } });
  });

  it("says what's wrong with each field", () => {
    expect(validateAnnouncement({ title: "", message: null, type: "party", endsOn: "2026-09-14" }, today)).toEqual({
      errors: { type: "Pick a category.", title: "Give it a title.", message: "Write the message members will see.", endsOn: "That date has passed. Pick today or later, or clear it." },
    });
    expect(validateAnnouncement({ title: "x".repeat(81), message: "y".repeat(401), type: "general", endsOn: "2026-02-31" }, today)).toEqual({
      errors: { title: "Keep the title to 80 characters.", message: "Keep the message to 400 characters.", endsOn: "That isn’t a real date." },
    });
  });
});
