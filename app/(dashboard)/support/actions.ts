"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { getLogoUrl } from "@/lib/email/logo";
import SupportRequest from "@/lib/email/templates/support-request";
import { createElement } from "react";

const VALID_TOPICS = [
  "Booking Issue",
  "Payments & Refunds",
  "Induction",
  "Access Pass",
  "General Enquiry",
];

export async function sendSupportRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in to contact support." };

  const topic = (formData.get("topic") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();

  if (!VALID_TOPICS.includes(topic)) return { error: "Please pick a topic." };
  if (!message || message.length < 10)
    return { error: "Tell us a little more — at least 10 characters." };
  if (message.length > 2000)
    return { error: "Message is too long (max 2000 characters)." };

  const { data: member } = await supabase
    .from("members")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const memberName = member?.full_name || "Member";
  const memberEmail = member?.email || user.email || "unknown";

  try {
    await sendEmail({
      to: process.env.SUPPORT_INBOX || "hello@inspire9.com",
      subject: `[Support] ${topic} — ${memberName}`,
      react: createElement(SupportRequest, {
        memberName,
        memberEmail,
        topic,
        message,
        logoDataUrl: getLogoUrl(),
      }),
    });
  } catch (err) {
    console.error("[support] Email failed:", err);
    return { error: "Could not send your message. Please try again." };
  }

  return { success: true };
}
