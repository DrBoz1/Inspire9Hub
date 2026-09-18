import { describe, expect, it } from "vitest";
import {
  boardStats,
  channelBreakdown,
  dayLabel,
  daysToWin,
  filterCounts,
  followUpState,
  funnel,
  isStale,
  searchLeads,
  sortForBoard,
  stageNote,
  stagePatch,
  toLead,
  toLeadNote,
  validateLead,
  validateNote,
  whenLabel,
  type Lead,
  type RawLead,
} from "./admin-leads";

let seq = 0;
const lead = (over: Partial<RawLead> = {}): Lead => {
  seq += 1;
  return toLead({ id: `l${seq}`, name: "Alex Chen", email: "alex@northwind.com", stage: "new", created_at: "2026-09-01T00:00:00.000Z", ...over });
};
// Midday Friday 18 September in Melbourne.
const NOW = new Date("2026-09-18T02:00:00Z");

describe("validating an enquiry", () => {
  it("tidies what people type", () => {
    const r = validateLead({ name: "  Alex   Chen ", email: " Alex@Northwind.COM ", phone: "0412 345 678", teamSize: "4", interest: "private_office", heardVia: "friend", message: "Hi\r\nthere" });
    expect(r).toEqual({
      values: {
        name: "Alex Chen",
        email: "alex@northwind.com",
        phone: "0412 345 678",
        company: null,
        interest: "private_office",
        team_size: 4,
        message: "Hi\nthere",
        heard_via: "friend",
        source: "website",
        next_follow_up: null,
      },
    });
  });

  it("asks for a name and a way to reply", () => {
    expect(validateLead({})).toEqual({ errors: { name: "Tell us your name.", email: "We need an email address to reply to." } });
  });

  it("catches typos in contact details", () => {
    const r = validateLead({ name: "A", email: "alex@northwind", phone: "call me" });
    expect("errors" in r && Object.keys(r.errors)).toEqual(["email", "phone"]);
    expect("errors" in validateLead({ name: "A", email: "alex @x.com" })).toBe(true);
    expect("values" in validateLead({ name: "A", email: "a.b+tag@mail.example.com.au" })).toBe(true);
  });

  it("wants a sensible team size", () => {
    for (const bad of ["0", "2.5", "600", "lots"]) expect("errors" in validateLead({ name: "A", email: "a@b.co", teamSize: bad })).toBe(true);
    expect(validateLead({ name: "A", email: "a@b.co", teamSize: "" })).toMatchObject({ values: { team_size: null } });
  });

  it("rejects a made-up option but defaults a missing interest", () => {
    expect(validateLead({ name: "A", email: "a@b.co", interest: "castle" })).toMatchObject({ errors: { interest: "Pick one of the options." } });
    expect(validateLead({ name: "A", email: "a@b.co" })).toMatchObject({ values: { interest: "other" } });
  });

  it("won't let a visitor set the fields only staff set", () => {
    // A tampered public form can't claim to be a referral or book its own follow-up.
    const r = validateLead({ name: "A", email: "a@b.co", source: "referral", nextFollowUp: "2026-12-01" });
    expect(r).toMatchObject({ values: { source: "website", next_follow_up: null } });
  });

  it("checks the staff-only fields on the admin form", () => {
    expect(validateLead({ name: "A", email: "a@b.co", source: "walk_in", nextFollowUp: "2026-09-20" }, { staff: true, today: "2026-09-18" })).toMatchObject({
      values: { source: "walk_in", next_follow_up: "2026-09-20" },
    });
    expect(validateLead({ name: "A", email: "a@b.co" }, { staff: true })).toMatchObject({ errors: { source: "Pick where this lead came from." } });
    expect(validateLead({ name: "A", email: "a@b.co", source: "phone", nextFollowUp: "2026-09-01" }, { staff: true, today: "2026-09-18" })).toMatchObject({
      errors: { nextFollowUp: "Pick today or a later date." },
    });
  });
});

describe("reading a lead", () => {
  it("fills sensible defaults and never trusts an unknown option", () => {
    const l = toLead({ id: "x", name: " ", email: " A@B.CO ", interest: "castle", source: "carrier pigeon", stage: "sideways", created_at: "2026-09-01T00:00:00Z" });
    expect([l.name, l.email, l.interest, l.source, l.stage, l.furthestStage]).toEqual(["Unnamed", "a@b.co", "other", "other", "new", "new"]);
    expect(l.lastActivityAt).toBe("2026-09-01T00:00:00Z");
  });

  it("never reports a furthest stage behind the current one", () => {
    expect(lead({ stage: "trial", furthest_stage: "contacted" }).furthestStage).toBe("trial");
    expect(lead({ stage: "lost", furthest_stage: "tour_booked" }).furthestStage).toBe("tour_booked");
  });
});

describe("moving through the pipeline", () => {
  it("records how far a lead got", () => {
    const r = stagePatch(lead({ stage: "new" }), "tour_booked", NOW);
    expect(r).toMatchObject({ patch: { stage: "tour_booked", furthest_stage: "tour_booked", closed_at: null, lost_reason: null } });
  });

  it("needs a reason to mark a lead lost, and keeps how far it got", () => {
    const toured = lead({ stage: "tour_booked", furthest_stage: "tour_booked" });
    expect(stagePatch(toured, "lost", NOW)).toEqual({ error: "Say why it was lost. It’s what makes the losses worth looking at." });
    expect(stagePatch(toured, "lost", NOW, "price")).toMatchObject({
      patch: { stage: "lost", furthest_stage: "tour_booked", lost_reason: "price", closed_at: NOW.toISOString() },
    });
  });

  it("reopens cleanly without forgetting the history", () => {
    const lost = lead({ stage: "lost", furthest_stage: "trial", lost_reason: "timing", closed_at: "2026-09-10T00:00:00Z" });
    // Back to "contacted": still counts as having reached a trial.
    expect(stagePatch(lost, "contacted", NOW)).toMatchObject({ patch: { stage: "contacted", furthest_stage: "trial", closed_at: null, lost_reason: null } });
  });

  it("keeps the original close date when a closed lead only changes outcome", () => {
    const won = lead({ stage: "won", furthest_stage: "won", closed_at: "2026-09-10T00:00:00Z" });
    expect(stagePatch(won, "lost", NOW, "other")).toMatchObject({ patch: { closed_at: "2026-09-10T00:00:00Z" } });
  });

  it("refuses a move to where it already is, or to nowhere", () => {
    expect("error" in stagePatch(lead(), "new", NOW)).toBe(true);
    expect("error" in stagePatch(lead(), "sideways" as never, NOW)).toBe(true);
  });

  it("writes the move into the timeline", () => {
    expect(stageNote("tour_booked", "lost", "competitor")).toBe("Moved from Tour booked to Lost: chose another space");
    expect(stageNote("new", "contacted")).toBe("Moved from New to Contacted");
  });
});

describe("the funnel", () => {
  it("counts a lead at every step it passed, even if it was lost later", () => {
    const leads = [
      lead({ stage: "new" }),
      lead({ stage: "contacted", furthest_stage: "contacted" }),
      lead({ stage: "lost", furthest_stage: "tour_booked", lost_reason: "price" }),
      lead({ stage: "won", furthest_stage: "won" }),
    ];
    const { steps, lost, open, winRate } = funnel(leads);
    expect(steps.map((s) => [s.stage, s.count])).toEqual([
      ["new", 4],
      ["contacted", 3],
      ["tour_booked", 2],
      ["trial", 1],
      ["won", 1],
    ]);
    // Judged on the current stage alone, only 1 of these would have toured, not 2.
    expect(steps[2].fromPrevious).toBeCloseTo(2 / 3, 6);
    expect(steps[4].fromStart).toBe(0.25);
    expect([lost, open, winRate]).toEqual([1, 2, 0.5]);
  });

  it("has no rates rather than zeros when there's nothing to measure", () => {
    const { steps, winRate } = funnel([]);
    expect(steps.every((s) => s.count === 0 && s.fromStart === null)).toBe(true);
    expect(winRate).toBeNull();
  });

  it("splits leads and wins by channel, judging win rate only on closed leads", () => {
    const rows = channelBreakdown(
      [
        lead({ source: "website", heard_via: "search", stage: "won" }),
        lead({ source: "website", heard_via: "search", stage: "lost", lost_reason: "price" }),
        lead({ source: "website", heard_via: null, stage: "new" }),
        lead({ source: "walk_in", heard_via: "passing", stage: "won" }),
      ],
      "source",
    );
    expect(rows.map((r) => [r.label, r.leads, r.won, r.winRate])).toEqual([
      ["Website", 3, 1, 0.5],
      ["Walk-in", 1, 1, 1],
    ]);
    const heard = channelBreakdown([lead({ heard_via: null }), lead({ heard_via: "friend" })], "heardVia");
    expect(heard.map((r) => r.label).sort()).toEqual(["A friend or colleague", "Didn’t say"]);
  });

  it("takes the median days to win on Melbourne dates", () => {
    const won = (created: string, closed: string) => lead({ stage: "won", furthest_stage: "won", created_at: created, closed_at: closed });
    // 11pm UTC on the 1st is already the 2nd in Melbourne.
    expect(daysToWin([won("2026-09-01T23:00:00Z", "2026-09-05T02:00:00Z")])).toBe(3);
    expect(daysToWin([won("2026-09-01T02:00:00Z", "2026-09-03T02:00:00Z"), won("2026-09-01T02:00:00Z", "2026-09-11T02:00:00Z")])).toBe(6);
    expect(daysToWin([lead()])).toBeNull();
  });
});

describe("keeping on top of the board", () => {
  it("places follow-ups relative to today in Melbourne", () => {
    const at = (date: string, stage = "contacted") => followUpState(lead({ next_follow_up: date, stage }), NOW);
    expect([at("2026-09-17"), at("2026-09-18"), at("2026-09-20"), at("2026-09-30")]).toEqual(["overdue", "today", "soon", "later"]);
    expect(at("2026-09-01", "won")).toBe("none");
    // 11pm UTC on the 17th is already the 18th in Melbourne, so a follow-up for the 18th is due today.
    expect(followUpState(lead({ next_follow_up: "2026-09-18" }), new Date("2026-09-17T23:00:00Z"))).toBe("today");
  });

  it("flags an open lead nobody has touched for a week", () => {
    expect(isStale(lead({ last_activity_at: "2026-09-10T00:00:00Z" }), NOW)).toBe(true);
    expect(isStale(lead({ last_activity_at: "2026-09-15T00:00:00Z" }), NOW)).toBe(false);
    // A booked follow-up means someone has it in hand.
    expect(isStale(lead({ last_activity_at: "2026-09-01T00:00:00Z", next_follow_up: "2026-09-25" }), NOW)).toBe(false);
    expect(isStale(lead({ last_activity_at: "2026-09-01T00:00:00Z", stage: "lost" }), NOW)).toBe(false);
  });

  it("puts the most urgent at the top", () => {
    const quiet = lead({ name: "Quiet", stage: "contacted", last_activity_at: "2026-09-01T00:00:00Z" });
    const overdue = lead({ name: "Overdue", stage: "contacted", next_follow_up: "2026-09-10" });
    const fresh = lead({ name: "Fresh", created_at: "2026-09-17T00:00:00Z", last_activity_at: "2026-09-17T00:00:00Z" });
    const won = lead({ name: "Won", stage: "won", furthest_stage: "won" });
    const today = lead({ name: "Today", stage: "trial", next_follow_up: "2026-09-18", last_activity_at: "2026-09-17T00:00:00Z" });
    expect(sortForBoard([won, fresh, quiet, today, overdue], NOW).map((l) => l.name)).toEqual(["Overdue", "Today", "Quiet", "Fresh", "Won"]);
  });

  it("finds people by name, email, company or phone however it was typed", () => {
    const leads = [lead({ name: "Priya Nair", company: "Studio Nine", phone: "0412 345 678" }), lead({ name: "Sam Taylor", email: "sam@taylor.dev" })];
    expect(searchLeads(leads, "studio").map((l) => l.name)).toEqual(["Priya Nair"]);
    expect(searchLeads(leads, "TAYLOR.DEV").map((l) => l.name)).toEqual(["Sam Taylor"]);
    expect(searchLeads(leads, "0412345").map((l) => l.name)).toEqual(["Priya Nair"]);
    expect(searchLeads(leads, "  ")).toHaveLength(2);
  });

  it("counts each filter", () => {
    const counts = filterCounts([lead(), lead({ stage: "trial" }), lead({ stage: "won" }), lead({ stage: "lost" })]);
    expect([counts.open, counts.all, counts.new, counts.won, counts.lost]).toEqual([2, 4, 1, 1, 1]);
  });
});

describe("the board's words and numbers", () => {
  it("says when a lead came in, on the Melbourne calendar", () => {
    expect(whenLabel("2026-09-18T01:00:00Z", NOW)).toBe("Today");
    // 11pm UTC on the 16th was already the 17th in Melbourne: yesterday, not two days ago.
    expect(whenLabel("2026-09-16T23:00:00Z", NOW)).toBe("Yesterday");
    expect(whenLabel("2026-09-14T02:00:00Z", NOW)).toBe("4 days ago");
    expect(whenLabel("2026-09-10T02:00:00Z", NOW)).toBe("1 week ago");
    expect(whenLabel("2026-08-30T02:00:00Z", NOW)).toBe("2 weeks ago");
    expect(whenLabel("2026-03-05T02:00:00Z", NOW)).toBe("5 Mar");
  });

  it("writes follow-up dates the way people say them", () => {
    expect(dayLabel("2026-09-17")).toBe("Thu 17 Sep");
    expect(dayLabel("2027-01-03")).toBe("Sun 3 Jan");
    expect(dayLabel("not a date")).toBe("not a date");
  });

  it("counts what's open, untouched, due and quiet, and how it's going", () => {
    const stats = boardStats(
      [
        lead({ stage: "new", last_activity_at: "2026-09-17T00:00:00Z" }),
        lead({ stage: "contacted", next_follow_up: "2026-09-18" }),
        lead({ stage: "trial", last_activity_at: "2026-09-01T00:00:00Z" }),
        lead({ stage: "won", furthest_stage: "won" }),
        lead({ stage: "lost", lost_reason: "price" }),
        lead({ stage: "lost", lost_reason: "timing" }),
      ],
      NOW,
    );
    expect(stats).toEqual({ open: 3, untouched: 1, due: 1, stale: 1, won: 1, winRate: 1 / 3 });
  });

  it("lets staff log calls, emails, tours and notes, but not fake a stage change", () => {
    expect(validateNote("call", "  Left a voicemail\r\nwill try Friday ")).toEqual({ kind: "call", body: "Left a voicemail\nwill try Friday" });
    expect(validateNote("stage", "Moved to Won")).toEqual({ error: "Pick what kind of update this is." });
    expect(validateNote("note", "   ")).toEqual({ error: "Write what happened." });
    expect("error" in validateNote("note", "x".repeat(2001))).toBe(true);
  });

  it("reads a note with safe defaults", () => {
    expect(toLeadNote({ id: "n1", kind: "smoke signal", body: " Hi ", author_name: " ", created_at: "2026-09-18T00:00:00Z" })).toEqual({
      id: "n1", kind: "note", body: "Hi", author: null, createdAt: "2026-09-18T00:00:00Z",
    });
  });
});
