import { createElement } from "react";
import { render, toPlainText } from "@react-email/render";
import { describe, expect, it } from "vitest";
import BookingCancelled, { type CancelRefund } from "./booking-cancelled";
import RefundIssued from "./refund-issued";
import EnquiryReceived from "./enquiry-received";
import StaffAccess from "./staff-access";
import { MembershipCancelling, MembershipEnded, MembershipPaymentFailed, MembershipReceipt, MembershipWelcome, StaffMembershipAlert } from "./membership-emails";

// Plain text upper-cases labels, so words are compared without case.
const textOf = async (element: Parameters<typeof render>[0]) => toPlainText(await render(element)).toLowerCase();

const member = { memberName: "Sam Taylor", memberEmail: "sam@example.test" };
const booking = { ...member, roomName: "Boiler Room", bookingDate: "Monday 21 September 2026", startTime: "9:00 am", endTime: "11:00 am", bookingsUrl: "https://hub.example.test/bookings" };
const cancelled = (cancelledBy: "member" | "team", refund: CancelRefund) => createElement(BookingCancelled, { ...booking, cancelledBy, refund });

describe("booking cancelled", () => {
  it("says who cancelled, and what was booked", async () => {
    const mine = await textOf(cancelled("member", { kind: "unpaid" }));
    expect(mine).toContain("your booking is cancelled");
    expect(mine).toContain("as you asked");
    for (const value of [booking.roomName, booking.bookingDate, "9:00 am", "11:00 am", "melbourne time"]) expect(mine).toContain(value.toLowerCase());
    const theirs = await textOf(cancelled("team", { kind: "unpaid" }));
    expect(theirs).toContain("we’ve had to cancel your booking");
    expect(theirs).not.toContain("as you asked");
  });

  it("tells the member exactly what happens to their money", async () => {
    const full = await textOf(cancelled("member", { kind: "refunded", amountAUD: 128, percent: 100 }));
    expect(full).toContain("refund on its way");
    expect(full).toContain("$128.00");
    expect(full).toContain("100% of what you paid");

    const half = await textOf(cancelled("member", { kind: "refunded", amountAUD: 64, percent: 50 }));
    expect(half).toContain("$64.00");
    expect(half).toContain("50% of what you paid");

    const stuck = await textOf(cancelled("member", { kind: "pending", amountAUD: 64, percent: 50 }));
    expect(stuck).toContain("refund coming");
    expect(stuck).toContain("the team will send it");

    const late = await textOf(cancelled("member", { kind: "late" }));
    expect(late).toContain("less than 4 hours");
    expect(late).not.toContain("$");

    const none = await textOf(cancelled("team", { kind: "none" }));
    expect(none).toContain("no refund was issued");

    const unpaid = await textOf(cancelled("team", { kind: "unpaid" }));
    expect(unpaid).not.toContain("refund");
  });

  it("links back to booking another time", async () => {
    expect(await render(cancelled("member", { kind: "late" }))).toContain(`href="${booking.bookingsUrl}"`);
  });
});

describe("refund issued later", () => {
  it("gives the amount, the share and when to expect it", async () => {
    const text = await textOf(createElement(RefundIssued, { ...member, roomName: "Boiler Room", bookingDate: booking.bookingDate, amountAUD: 64, percent: 50, bookingsUrl: booking.bookingsUrl }));
    for (const value of ["your refund is on its way", "$64.00", "50% of what you paid", "5 to 10 business days", "boiler room"]) expect(text).toContain(value);
  });
});

describe("enquiry received", () => {
  it("thanks them by first name and says what they asked about", async () => {
    const text = await textOf(createElement(EnquiryReceived, { name: "Priya Nair", email: "priya@example.test", interest: "A private office" }));
    expect(text).toContain("hi priya");
    expect(text).toContain("a private office");
    expect(text).toContain("tour");
  });

  it("escapes a name a stranger typed", async () => {
    const html = await render(createElement(EnquiryReceived, { name: "<a href=https://evil.test>Click</a>", email: "x@example.test", interest: "A desk" }));
    expect(html).not.toContain("https://evil.test");
  });
});

describe("staff access", () => {
  it("says which access and links to the admin", async () => {
    const element = createElement(StaffAccess, { ...member, roleLabel: "Super admin", adminUrl: "https://hub.example.test/admin" });
    const text = await textOf(element);
    expect(text).toContain("super admin");
    expect(text).toContain("didn’t expect this");
    expect(await render(element)).toContain('href="https://hub.example.test/admin"');
  });
});

describe("membership emails", () => {
  const common = { ...member, planName: "Resident desk", membershipUrl: "https://hub.example.test/membership" };

  it("welcomes with the price, the next payment and the member rate", async () => {
    const element = createElement(MembershipWelcome, { ...common, priceLabel: "$75 a month", renewsOn: "20 October 2026", discountPercent: 20, spacesUrl: "https://hub.example.test/spaces" });
    const text = await textOf(element);
    for (const value of ["welcome to resident desk", "$75 a month", "20 october 2026", "20% off every room booking and day pass"]) expect(text).toContain(value);
    expect(await render(element)).toContain('href="https://hub.example.test/spaces"');
  });

  it("leaves out the member rate on a plan without one", async () => {
    const element = createElement(MembershipWelcome, { ...common, priceLabel: "$75 a month", renewsOn: null, discountPercent: 0, spacesUrl: "https://hub.example.test/spaces" });
    const text = await textOf(element);
    expect(text).not.toContain("member rate");
    expect(text).not.toContain("next payment");
    expect(await render(element)).toContain(`href="${common.membershipUrl}"`);
  });

  it("gives a receipt with the period, the invoice number and Stripe's invoice", async () => {
    const element = createElement(MembershipReceipt, { ...common, amountAUD: 75, periodLabel: "20 Sep – 19 Oct", paidOn: "20 September 2026", invoiceNumber: "ABC-0001", invoiceUrl: "https://invoice.stripe.test/i/1" });
    const text = await textOf(element);
    for (const value of ["payment received", "$75.00", "20 sep – 19 oct", "abc-0001"]) expect(text).toContain(value);
    expect(await render(element)).toContain('href="https://invoice.stripe.test/i/1"');
  });

  it("asks for a new card when a payment fails, and says when it retries", async () => {
    const retrying = await textOf(createElement(MembershipPaymentFailed, { ...common, amountAUD: 75, nextAttempt: "23 September 2026" }));
    expect(retrying).toContain("didn’t go through");
    expect(retrying).toContain("try your card again on 23 september 2026");
    const final = await textOf(createElement(MembershipPaymentFailed, { ...common, amountAUD: 75, nextAttempt: null }));
    expect(final).not.toContain("try your card again");
  });

  it("confirms a cancellation with the last day, and says how to undo it", async () => {
    const text = await textOf(createElement(MembershipCancelling, { ...common, endsOn: "20 October 2026" }));
    expect(text).toContain("20 october 2026");
    expect(text).toContain("won’t be charged again");
    expect(text).toContain("keep my membership");
  });

  it("says goodbye and how to come back", async () => {
    const text = await textOf(createElement(MembershipEnded, common));
    expect(text).toContain("has now ended");
    expect(text).toContain("rejoin");
  });

  it("tells the team who changed and what to know", async () => {
    for (const [kind, words] of [["joined", "joined resident desk"], ["cancelling", "is leaving"], ["payment_failed", "payment failed"], ["ended", "membership ended"]] as const) {
      const text = await textOf(createElement(StaffMembershipAlert, { kind, memberName: "Sam Taylor", memberEmail: member.memberEmail, planName: "Resident desk", detail: "Access until 20 October 2026", adminUrl: "https://hub.example.test/admin/memberships" }));
      expect(text).toContain(words);
      expect(text).toContain("access until 20 october 2026");
    }
  });
});
