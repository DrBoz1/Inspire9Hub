import { afterEach, describe, expect, it, vi } from "vitest";
import { isBookingAttempt, matchIntent, progressBooking, type AssistantContext, type BookingDraft } from "./engine";
import { formatAssistantHour, paymentTime } from "./time";

const now = new Date("2026-09-12T00:00:00Z"); // 10 am in Melbourne
const ctx: AssistantContext = {
  firstName: "Sam", memberSince: "2025-01-01T00:00:00Z", inductionStatus: "Complete", memberStatus: "Active",
  totalPaid: 140, totalRefunded: 20, netSpend: 120, payments: [], confirmedBookings: 3, cancelledBookings: 1, upcomingBookings: [], activePasses: 1,
  rooms: [{ id: "dream", name: "Dream Room", location: "Level 1", capacity: 8, pricePerHour: 50, amenities: ["wifi"] }, { id: "elbow", name: "Elbow Room", location: "Level 1", capacity: 4, pricePerHour: 30, amenities: ["wifi"] }],
};
const draft: BookingDraft = { roomId: "dream", roomName: "Dream Room", dateISO: "2026-09-20", startHour: 10, endHour: 12 };
const step = (query: string, previous: BookingDraft = draft) => progressBooking(query, ctx, previous, now);
afterEach(() => vi.useRealTimers());

describe("conversational booking", () => {
  it.each([["not tomorrow", "date"], ["not 2pm to 4pm", "time"], ["not Dream Room", "room"]])("asks for a replacement after '%s'", (query, field) => {
    const result = step(query);
    expect(result.readyToQuote).toBe(false);
    expect(result.nextMissing).toBe(field);
  });
  it("interprets a named room with a time as a booking request", () => {
    expect(isBookingAttempt("Dream Room tomorrow 2:30 to 4pm", ctx)).toBe(true);
  });
  it("collects a room, Melbourne date and explicit time", () => {
    expect(step("Book Dream Room tomorrow from 2pm to 4pm", {}).draft).toEqual({ roomId: "dream", roomName: "Dream Room", dateISO: "2026-09-13", startHour: 14, endHour: 16 });
  });
  it("does not infer today from a time-only correction", () => {
    expect(step("2pm to 4pm").draft).toEqual({ ...draft, startHour: 14, endHour: 16 });
  });
  it("accepts a date-only response without answering a spending question", () => {
    const result = step("Today", { roomId: "dream", roomName: "Dream Room" });
    expect(result.draft.dateISO).toBe("2026-09-12");
    expect(result.nextMissing).toBe("time");
    expect(result.reply.text).not.toContain("spend");
  });
  it.each(["Change the room", "Different room", "Wrong room"])("keeps the date and time for '%s'", query => {
    expect(step(query).draft).toEqual({ dateISO: draft.dateISO, startHour: 10, endHour: 12 });
    expect(step(query).nextMissing).toBe("room");
  });
  it("keeps room and date while changing time", () => {
    expect(step("Different time").draft).toEqual({ roomId: "dream", roomName: "Dream Room", dateISO: draft.dateISO });
  });
  it("keeps room and time while changing date", () => {
    expect(step("Change the date").draft).toEqual({ roomId: "dream", roomName: "Dream Room", startHour: 10, endHour: 12 });
  });
  it("changes an explicitly corrected room", () => {
    expect(step("not Dream Room, Elbow Room instead").draft).toEqual({ ...draft, roomId: "elbow", roomName: "Elbow Room" });
  });
  it("accepts a replacement date after a negated date", () => {
    expect(step("not today, tomorrow").draft.dateISO).toBe("2026-09-13");
  });
  it("uses explicit times ahead of an afternoon description", () => {
    expect(step("tomorrow afternoon from 2pm to 3pm").draft).toEqual({ ...draft, dateISO: "2026-09-13", startHour: 14, endHour: 15 });
  });
  it("preserves minutes rather than rounding the booking", () => {
    const result = step("2:30pm to 4pm");
    expect(result.readyToQuote).toBe(true);
    expect(result.draft.startHour).toBe(14.5);
    expect(paymentTime(result.draft.startHour!)).toBe("14:30");
    expect(formatAssistantHour(result.draft.startHour!)).toBe("2:30 PM");
  });
  it("understands duration in minutes", () => {
    expect(step("at 2pm for 90 minutes").draft).toEqual({ ...draft, startHour: 14, endHour: 15.5 });
  });
  it("preserves duration for a single start-time correction", () => {
    expect(step("actually make it 3pm").draft).toEqual({ ...draft, startHour: 15, endHour: 17 });
  });
  it.each(["7pm for 3 hours", "7am to 9am", "2pm to 1pm", "13pm to 3pm", "2:90pm to 4pm", "2pm for 30 minutes"])("rejects '%s' and clears stale times", query => {
    const result = step(query);
    expect(result.readyToQuote).toBe(false);
    expect(result.nextMissing).toBe("time");
    expect(result.draft.startHour).toBeUndefined();
    expect(result.draft.dateISO).toBe(draft.dateISO);
  });
  it("rejects a past start in the venue timezone", () => {
    const result = step("today 9am to 11am");
    expect(result.readyToQuote).toBe(false);
    expect(result.reply.text).toContain("passed in Melbourne");
  });
  it("rejects an explicitly past date without retaining the old date", () => {
    expect(step("September 10, 2026").draft.dateISO).toBeUndefined();
  });
  it("does not clear a draft for a cancellation-policy question", () => {
    const result = step("How do I cancel a booking?");
    expect(result.cancelled).toBe(false);
    expect(result.draft).toEqual(draft);
    expect(result.readyToQuote).toBe(false);
  });
  it("clears only the draft for an explicit cancellation", () => {
    expect(step("cancel draft")).toMatchObject({ cancelled: true, readyToQuote: false, draft: {} });
  });
  it("asks which field to correct for an ambiguous no", () => {
    expect(step("no")).toMatchObject({ draft, readyToQuote: false });
    expect(step("no").reply.suggestions).toContain("Change the room");
  });
  it("never picks a room from a shared amenity", () => {
    expect(step("Book a room with wifi tomorrow 2pm to 4pm", {}).draft.roomId).toBeUndefined();
  });
  it("asks for a choice when a name is ambiguous", () => {
    const rooms = [ { ...ctx.rooms[0], name: "North Studio" }, { ...ctx.rooms[1], name: "North Meeting Room" } ];
    expect(progressBooking("Book North tomorrow 2pm to 4pm", { ...ctx, rooms }, {}, now).nextMissing).toBe("room");
  });
  it("handles a small typo in a distinctive room name", () => {
    expect(step("book Drem tomorrow 2pm to 4pm", {}).draft.roomId).toBe("dream");
  });
});

describe("intent boundaries", () => {
  it("uses Melbourne boundaries for monthly spending", () => {
    vi.useFakeTimers(); vi.setSystemTime("2026-10-01T02:00:00Z");
    const result = matchIntent("How much did I spend this month?", { ...ctx, payments: [
      { amount: 50, refunded: 0, status: "paid", dateISO: "2026-09-30T15:00:00Z" },
      { amount: 30, refunded: 0, status: "paid", dateISO: "2026-09-30T13:00:00Z" },
    ] });
    expect(result.intentId).toBe("spending");
    expect(result.reply.text).toContain("$50.00");
    expect(result.reply.text).toContain("1 payment");
  });
  it.each(["Tell me about Dream Room", "How much does Dream Room cost?", "Does Dream Room have wifi?", "I don't want to book a room"])("doesn't start booking for '%s'", query => {
    expect(isBookingAttempt(query, ctx)).toBe(false);
  });
  it("answers room pricing from the actual room instead of account spending", () => {
    expect(matchIntent("How much does Dream Room cost?", ctx)).toMatchObject({ intentId: "room-info" });
    expect(matchIntent("How much does Dream Room cost?", ctx).reply.text).toContain("$50/hr");
  });
  it("doesn't mistake the no inside know for negation", () => {
    expect(matchIntent("I want to know my spending", ctx).intentId).toBe("spending");
  });
  it("uses dates as a follow-up only after spending", () => {
    expect(matchIntent("last month", ctx, null).intentId).not.toBe("spending");
    expect(matchIntent("last month", ctx, "spending").intentId).toBe("spending");
  });
  it("answers greetings and thanks without dumping account data", () => {
    expect(matchIntent("hello", ctx).intentId).toBe("hello");
    expect(matchIntent("thanks!", ctx).intentId).toBe("thanks");
  });
});
