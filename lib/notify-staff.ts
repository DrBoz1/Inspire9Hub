import { createElement } from "react";
import { sendOnce } from "@/lib/email/once";
import { teamInbox } from "@/lib/email/links";
import { getLogoUrl } from "@/lib/email/logo";
import SystemAlert from "@/lib/email/templates/system-alert";
import { ALERT_LABELS, alertFacts, alertKey, alertSubject, type StaffAlert } from "./alerts";

/**
 * Sends a staff alert: the delivery half of lib/alerts.ts.
 *
 * At most one email per problem per day, because sendOnce claims the key in
 * sent_emails before anything is sent. Never throws and never rethrows: an alert
 * failing must not fail the thing it was reporting on, which is by definition
 * already going badly.
 */
export async function notifyStaff(alert: StaffAlert, now = new Date()) {
  try {
    const result = await sendOnce(alertKey(alert, now), `alert:${alert.kind}`, {
      to: teamInbox(),
      subject: alertSubject(alert),
      react: createElement(SystemAlert, {
        label: ALERT_LABELS[alert.kind],
        headline: alert.headline,
        facts: alertFacts(alert.facts),
        action: alert.action ?? null,
        logoDataUrl: getLogoUrl(),
      }),
    });
    if (result === "failed") console.error(`[alert] ${alert.kind} couldn't be sent: ${alert.headline}`);
    return result;
  } catch (err) {
    console.error(`[alert] ${alert.kind} threw:`, err instanceof Error ? err.message : err);
    return "failed" as const;
  }
}
