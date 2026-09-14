import { describe, expect, it } from "vitest";
import { getLogoDataUrl } from "../logo";
import { generateInvoicePDF } from "./generate";

const booking = {
  bookingRef: "I9-TEST42", invoiceDate: "14 September 2026",
  memberName: "Sam Taylor", memberEmail: "sam@example.test",
  roomName: "Dream Room", location: "Inspire9 · Level 1",
  bookingDate: "Tuesday, 15 September 2026", startTime: "9:00 AM", endTime: "11:00 AM",
  durationHours: 2, hourlyRate: 55, totalAUD: 110,
};

describe("booking invoice rendering", () => {
  it.each([
    { name: "standard", data: booking },
    { name: "long names", data: { ...booking, memberName: "Alexandria Montgomery-Wellington and team", roomName: "The Collaboration & Strategy Room — North Wing" } },
  ])("keeps a $name invoice on one A4 page", async ({ data }) => {
    const pdf = await generateInvoicePDF(data);
    const source = pdf.toString("latin1");
    expect(source.startsWith("%PDF-")).toBe(true);
    expect(source.match(/\/Type \/Page\b/g)).toHaveLength(1);
    const dimensions = source.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
    expect(Number(dimensions?.[1])).toBeCloseTo(595.28, 2);
    expect(Number(dimensions?.[2])).toBeCloseTo(841.89, 2);
  });

  it("embeds the brand mark on consecutive invoice renders", async () => {
    const logoDataUrl = getLogoDataUrl();
    expect(logoDataUrl).toMatch(/^data:image\/png;base64,/);
    for (let i = 0; i < 2; i++) {
      const pdf = await generateInvoicePDF({ ...booking, logoDataUrl });
      expect(pdf.toString("latin1")).toContain("/Subtype /Image");
    }
  });
});
