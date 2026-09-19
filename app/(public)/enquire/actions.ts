"use server";

import { createElement } from "react";
import { headers } from "next/headers";
import { after } from "next/server";
import { HEARD_VIA, INTERESTS, SOURCES, validateLead, type LeadErrors, type LeadField } from "@/lib/admin-leads";
import { WindowLimiter, clientKey, looksAutomated } from "@/lib/enquiry-guard";
import { captureLead } from "@/lib/leads-capture";
import { sendEmail } from "@/lib/email/send";
import { getLogoUrl } from "@/lib/email/logo";
import NewLead from "@/lib/email/templates/new-lead";
import EnquiryReceived from "@/lib/email/templates/enquiry-received";
import { sendQuietly } from "@/lib/email/once";
import { teamInbox } from "@/lib/email/links";

/**
 * The public enquiry form. Anyone can call this, signed in or not, so it trusts
 * nothing: every field is re-validated, bots are turned away quietly, and each
 * visitor is rate limited. Problems come back as values, never thrown: Next
 * hides thrown messages in production.
 */

export type EnquiryState =
  | { status: "idle" }
  /** `attempt` is new on every failure, so the form can remount with what was typed (see EnquiryForm). */
  | { status: "error"; error?: string; fieldErrors?: LeadErrors; values: Partial<Record<LeadField, string>>; attempt: number }
  | { status: "sent"; firstName: string };

const FIELDS: LeadField[] = ["name", "email", "phone", "company", "interest", "teamSize", "message", "heardVia"];
const INBOX = process.env.SUPPORT_INBOX || "hello@inspire9.com";

// Held per server instance: see WindowLimiter for what that does and doesn't stop.
const perVisitor = new WindowLimiter(5, 10 * 60_000);
/** Caps staff email from a flood even when each sender stays under their own limit. Leads still save. */
const staffAlerts = new WindowLimiter(30, 60 * 60_000);
/** Caps replies to enquirers the same way: the address is typed by a stranger, so the form must not become a way to send mail. */
const replies = new WindowLimiter(30, 60 * 60_000);

export async function submitEnquiry(_previous: EnquiryState, form: FormData): Promise<EnquiryState> {
  const now = Date.now();
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(form.get(f) ?? "")])) as Record<LeadField, string>;

  // A bot is told it worked. Telling it otherwise only teaches it what to change.
  if (looksAutomated({ honeypot: form.get("website"), startedAt: form.get("startedAt") }, now)) {
    return { status: "sent", firstName: "" };
  }

  // Validation first, so fixing a typo doesn't use up anyone's allowance.
  const checked = validateLead(values);
  if ("errors" in checked) return { status: "error", error: "Check the highlighted fields.", fieldErrors: checked.errors, values, attempt: now };

  const request = await headers();
  const allowed = perVisitor.take(clientKey(request.get("x-forwarded-for"), request.get("x-real-ip")), now);
  if (!allowed.ok) {
    const minutes = Math.max(1, Math.ceil(allowed.retryAfterMs / 60_000));
    return { status: "error", error: `That’s a few enquiries in a row. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or email hello@inspire9.com.`, values, attempt: now };
  }

  const lead = checked.values;
  const saved = await captureLead(lead, { source: "website" });
  if (!saved.saved) console.error("[enquire] not saved to leads:", saved.reason);

  // When the lead couldn't be saved, this email is the only copy, so it always goes.
  if (!saved.saved || staffAlerts.take("staff", now).ok) {
    try {
      await sendEmail({
        to: INBOX,
        replyTo: lead.email,
        subject: `${saved.saved && saved.repeat ? "[Lead] Enquired again" : "[Lead] New enquiry"}: ${lead.name}, ${INTERESTS[lead.interest]}`,
        react: createElement(NewLead, {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          interest: INTERESTS[lead.interest],
          teamSize: lead.team_size,
          heardVia: lead.heard_via ? HEARD_VIA[lead.heard_via] : null,
          message: lead.message,
          source: SOURCES.website,
          repeat: saved.saved && saved.repeat,
          leadUrl: saved.saved ? `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/admin/leads?lead=${saved.leadId}` : null,
          logoDataUrl: getLogoUrl(),
        }),
      });
    } catch (err) {
      console.error("[enquire] staff email failed:", err instanceof Error ? err.message : err);
      // Saved on the board, so nobody misses it. Not saved AND not emailed: say so, rather than pretend.
      if (!saved.saved) return { status: "error", error: "We couldn’t send that just now. Please email hello@inspire9.com and we’ll get straight back to you.", values, attempt: now };
    }
  }

  // One reply per open enquiry: a repeat from the same address, or a lead that didn't save, gets none.
  if (saved.saved && !saved.repeat && replies.take("replies", now).ok) {
    after(() =>
      sendQuietly("enquiry reply", {
        to: lead.email,
        replyTo: teamInbox(),
        subject: "Thanks for your enquiry, Inspire9",
        react: createElement(EnquiryReceived, { name: lead.name, email: lead.email, interest: INTERESTS[lead.interest], logoDataUrl: getLogoUrl() }),
      }),
    );
  }

  // The same answer whether this address had enquired before, so the form can't be used to find out who has.
  return { status: "sent", firstName: lead.name.split(" ")[0] };
}
