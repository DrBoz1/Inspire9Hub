import { createElement } from "react";
import { render, toPlainText } from "@react-email/render";
import { describe, expect, it } from "vitest";
import BookingConfirmation from "./booking-confirmation";
import InductionApproved from "./induction-approved";
import InductionSubmitted from "./induction-submitted";
import InductionRejected from "./induction-rejected";
import ReviewReminder from "./review-reminder";
import SupportRequest from "./support-request";
import NewLead from "./new-lead";

const member = { memberName: "Sam Taylor", memberEmail: "sam@example.test" };
const booking = {
  ...member, roomName: "Dream Room", location: "Inspire9 · Level 1",
  bookingDate: "Monday, 14 September 2026", startTime: "9:00 AM", endTime: "11:00 AM",
  durationHours: 2, totalAUD: 110, bookingRef: "I9-TEST42", dashboardUrl: "https://hub.example.test/dashboard",
};

describe("transactional email presentation", () => {
  it("preserves the confirmed reservation, receipt values and supplied destination", async () => {
    const html = await render(createElement(BookingConfirmation, booking));
    const text = toPlainText(html);
    for (const value of [booking.memberName, booking.memberEmail, booking.roomName, booking.location,
      booking.bookingDate, booking.startTime, booking.endTime, booking.bookingRef, "$110.00", "AUD", "Including GST", "2 hours", "Melbourne time"]) {
      expect(text.toLowerCase()).toContain(value.toLowerCase());
    }
    expect(html).toContain('href="' + booking.dashboardUrl + '"');
    // Delivery can succeed without the attachment if PDF generation fails.
    expect(text).not.toMatch(/invoice (is )?attached|attached invoice/i);
  });

  it.each([
    { name: "approved", element: createElement(InductionApproved, { ...member, bookingsUrl: "https://hub.example.test/bookings" }), url: "https://hub.example.test/bookings", copy: "induction is approved" },
    { name: "submitted", element: createElement(InductionSubmitted, { ...member, dashboardUrl: "https://hub.example.test/dashboard" }), url: "https://hub.example.test/dashboard", copy: "team will review" },
    { name: "resubmission", element: createElement(InductionRejected, { ...member, inductionUrl: "https://hub.example.test/induction" }), url: "https://hub.example.test/induction", copy: "resubmit" },
    { name: "review", element: createElement(ReviewReminder, { ...member, reviewUrl: "https://reviews.example.test/inspire9" }), url: "https://reviews.example.test/inspire9", copy: "honest feedback" },
  ])("keeps $name status and action intact", async ({ element, url, copy }) => {
    const html = await render(element);
    expect(html).toContain('href="' + url + '"');
    expect(toPlainText(html)).toContain(copy);
    expect(toPlainText(html)).toContain(member.memberEmail);
  });

  it("escapes member content, retains message line breaks and addresses the member when replying", async () => {
    const html = await render(createElement(SupportRequest, {
      ...member, topic: "Booking & payment", message: '<script>alert("x")</script>\nSecond line',
    }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("white-space:pre-wrap");
    expect(toPlainText(html)).toContain("Second line");
    expect(html).toContain('href="mailto:' + member.memberEmail + '"');
  });

  it("uses a hosted logo with useful alternative text and a readable fallback", async () => {
    const withLogo = await render(createElement(BookingConfirmation, { ...booking, logoDataUrl: "https://hub.example.test/logo.png" }));
    expect(withLogo).toContain('alt="Inspire9 Hub"');
    expect(withLogo).toContain('src="https://hub.example.test/logo.png"');
    const withoutLogo = await render(createElement(BookingConfirmation, booking));
    expect(withoutLogo).not.toContain("<img");
    expect(toPlainText(withoutLogo)).toContain("inspire9");
  });

  const enquiry = {
    name: "Priya Nair", email: "priya@studionine.test", phone: "0412 345 678", company: "Studio Nine",
    interest: "Private office", teamSize: 4, heardVia: "A friend or colleague", source: "Website",
    message: "Could we see the office?", repeat: false, leadUrl: "https://hub.example.test/admin/leads?lead=abc",
  };

  it("gives staff everything they need to answer a new enquiry", async () => {
    // Plain text upper-cases headings, so compare without case.
    const text = toPlainText(await render(createElement(NewLead, enquiry))).toLowerCase();
    for (const value of ["Someone wants to join", enquiry.name, enquiry.email, enquiry.phone, enquiry.company, enquiry.interest, "4", enquiry.heardVia, enquiry.message, "Open the lead"]) {
      expect(text).toContain(value.toLowerCase());
    }
  });

  it("escapes what a stranger typed, and leaves out what they didn't give", async () => {
    const html = await render(createElement(NewLead, { ...enquiry, phone: null, company: null, teamSize: null, heardVia: null, message: "<img src=x onerror=alert(1)>" }));
    expect(html).not.toContain("<img src=x");
    const text = toPlainText(html);
    expect(text).not.toContain("Phone");
    expect(text).not.toContain("Team size");
  });

  it("says plainly when the email is the only copy", async () => {
    const html = await render(createElement(NewLead, { ...enquiry, leadUrl: null, repeat: true }));
    expect(toPlainText(html)).toContain("the only copy");
    expect(toPlainText(html).toLowerCase()).toContain("got in touch again");
    expect(html).toContain('href="mailto:' + enquiry.email + '"');
  });
});
