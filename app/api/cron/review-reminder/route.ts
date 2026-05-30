import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { getLogoUrl } from "@/lib/email/logo";
import ReviewReminder from "@/lib/email/templates/review-reminder";
import { createElement } from "react";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // fs module needed for logo; not edge

const REVIEW_URL =
  "https://www.google.com/search?q=inspire9#lrd=0x6ad6429304854a99:0x54b14a9ff281a28,3,,,,";

// How many days must pass before we send another review reminder to the same member
const COOLDOWN_DAYS = 30;

// ── Shared logic ────────────────────────────────────────────────────────────

async function runReviewReminders(dryRun = false) {
  const supabase = createAdminClient();

  // 1. Fetch all active + inducted members
  const { data: activeMembers, error: membersErr } = await supabase
    .from("members")
    .select("id, full_name, email, member_status, induction_status")
    .eq("member_status", "Active")
    .eq("induction_status", "Complete");

  if (membersErr || !activeMembers) {
    console.error("[review-reminder] Member fetch error:", membersErr);
    return { error: "Failed to fetch members", sent: 0, skipped: 0, eligible: [] };
  }

  if (activeMembers.length === 0) {
    return { sent: 0, skipped: 0, eligible: [], message: "No active members found." };
  }

  const memberIds = activeMembers.map((m) => m.id);

  // 2. Find members who already received a reminder within the cooldown window
  const cooldownCutoff = new Date();
  cooldownCutoff.setDate(cooldownCutoff.getDate() - COOLDOWN_DAYS);

  const { data: recentNotifications } = await supabase
    .from("notifications")
    .select("member_id")
    .eq("type", "review_reminder")
    .eq("status", "sent")
    .in("member_id", memberIds)
    .gte("sent_date", cooldownCutoff.toISOString());

  const recentlySentIds = new Set(
    (recentNotifications ?? []).map((n: { member_id: string }) => n.member_id),
  );

  // 3. Filter to eligible members only
  const eligible = activeMembers.filter((m) => !recentlySentIds.has(m.id));
  const skipped = activeMembers.length - eligible.length;

  if (eligible.length === 0) {
    return {
      sent: 0,
      skipped,
      eligible: [],
      message: `All ${skipped} active member(s) received a reminder within the last ${COOLDOWN_DAYS} days.`,
    };
  }

  // Dry run: return who would receive without actually sending
  if (dryRun) {
    return {
      sent: 0,
      skipped,
      eligible: eligible.map((m) => ({
        name: m.full_name,
        email: m.email,
      })),
      message: `Dry run — ${eligible.length} member(s) would receive a reminder.`,
    };
  }

  // 4. Send emails and record in notifications table
  const logoDataUrl = getLogoUrl();
  let sent = 0;
  const errors: string[] = [];

  for (const member of eligible) {
    if (!member.email) continue;

    try {
      await sendEmail({
        to: member.email,
        subject: "How has your experience at Inspire9 been? ⭐",
        react: createElement(ReviewReminder, {
          memberName: member.full_name ?? "Member",
          memberEmail: member.email,
          reviewUrl: REVIEW_URL,
          logoDataUrl,
        }),
      });

      // Record the notification so we respect the cooldown
      const { error: notifErr } = await supabase.from("notifications").insert({
        member_id: member.id,
        type: "review_reminder",
        status: "sent",
        sent_date: new Date().toISOString(),
      });

      if (notifErr) {
        // If this fails, the cooldown won't work next time — log so we can diagnose
        console.error(
          `[review-reminder] ⚠️ Cooldown record FAILED for ${member.email}:`,
          JSON.stringify(notifErr),
          "— Email was sent but this person will be eligible again next run.",
        );
      }

      sent++;
      console.log(`[review-reminder] Sent to: ${member.email}`);
    } catch (err) {
      console.error(`[review-reminder] Failed for ${member.email}:`, err);
      errors.push(member.email);

      // Record as failed so we can retry later
      await supabase.from("notifications").insert({
        member_id: member.id,
        type: "review_reminder",
        status: "failed",
        sent_date: new Date().toISOString(),
      });
    }
  }

  return {
    sent,
    skipped,
    failed: errors.length,
    errors: errors.length > 0 ? errors : undefined,
    eligible: eligible.map((m) => ({ name: m.full_name, email: m.email })),
    message: `Sent ${sent}/${eligible.length} review reminders. ${skipped} skipped (within ${COOLDOWN_DAYS}-day cooldown).`,
  };
}

// ── GET — Vercel Cron Job (authenticated via CRON_SECRET) ───────────────────
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[review-reminder] Unauthorized GET attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[review-reminder] Triggered by Vercel Cron");
  const result = await runReviewReminders(false);
  return NextResponse.json(result);
}

// ── POST — Manual admin trigger ──────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Validate admin session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get("dryRun") === "true";
  const resetCooldowns = searchParams.get("reset") === "true";

  // Dev/demo helper — wipes all review_reminder cooldown records so everyone is eligible again
  if (resetCooldowns) {
    const adminDb = createAdminClient();
    const { error } = await adminDb
      .from("notifications")
      .delete()
      .eq("type", "review_reminder");
    console.log("[review-reminder] Cooldowns reset by admin:", user.id);
    return NextResponse.json({
      reset: true,
      error: error?.message ?? null,
      message: error
        ? `Reset failed: ${error.message}`
        : "All review reminder cooldowns cleared. Everyone is eligible for the next send.",
    });
  }

  console.log(
    `[review-reminder] Manual trigger by admin ${user.id} (dryRun=${dryRun})`,
  );

  const result = await runReviewReminders(dryRun);
  return NextResponse.json(result);
}
