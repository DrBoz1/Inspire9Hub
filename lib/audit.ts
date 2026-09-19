import { createAdminClient } from "@/lib/supabase/admin";

/**
 * What staff did, recorded as it happens. community_entries logs induction
 * decisions and successful bookings; this covers everything else an admin can
 * do -- cancelling, refunding, repricing a room, granting admin access.
 *
 * Server only: it writes with the service-role client.
 */

/** Machine keys, listed so a typo is a type error rather than a row nobody can find. */
export type AuditAction =
  | "booking.cancel"
  | "booking.cancel_refund"
  | "booking.refund"
  | "room.update"
  | "staff.add"
  | "staff.role_change"
  | "staff.remove"
  | "staff.remove_stale"
  | "announcement.save"
  | "announcement.archive"
  | "announcement.restore"
  | "announcement.delete"
  | "induction.approve"
  | "induction.reject"
  | "lead.create"
  | "lead.stage"
  | "lead.update"
  | "lead.convert"
  | "plans.sync";

export type AuditEntity = "booking" | "payment" | "room" | "staff" | "announcement" | "member" | "lead" | "plan";

export type AuditActor = { id: string; email?: string | null } | null;

export type AuditEntry = {
  actor: AuditActor;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  /** One human-readable line, written where the context is known. */
  summary: string;
  meta?: Record<string, unknown>;
};

export type AuditRow = {
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string;
  meta: Record<string, unknown>;
};

/** Pure, so the shaping is testable without a database. */
export function auditRow(entry: AuditEntry): AuditRow {
  return {
    actor_id: entry.actor?.id ?? null,
    actor_email: entry.actor?.email?.trim().toLowerCase() || null,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId ?? null,
    summary: entry.summary.trim(),
    meta: entry.meta ?? {},
  };
}

/**
 * Best-effort extra detail on a row that has already changed: when a booking was
 * cancelled and by whom, when a payment was refunded. Written separately from the
 * real change so that change never depends on these columns. A database that
 * hasn't had add_booking_audit_columns.sql / add_payment_columns.sql run yet
 * rejects unknown columns outright, and that must not block a cancellation.
 */
export async function stampRow(table: "bookings" | "payments", id: string, fields: Record<string, unknown>): Promise<void> {
  try {
    const { error } = await createAdminClient().from(table).update(fields).eq("id", id);
    if (error) console.error(`[audit] ${table} ${id} not stamped:`, error.message);
  } catch (err) {
    console.error(`[audit] ${table} ${id} not stamped:`, err instanceof Error ? err.message : String(err));
  }
}

/**
 * Never throws and never returns a failure: an action that genuinely succeeded
 * must not report an error because its log line didn't save. Failures are
 * logged loudly instead, because a silently empty audit trail is the one way
 * this feature can be worse than not having it.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const { error } = await createAdminClient().from("admin_audit").insert(auditRow(entry));
    if (error) console.error(`[audit] ${entry.action} not recorded:`, error.message);
  } catch (err) {
    console.error(`[audit] ${entry.action} not recorded:`, err instanceof Error ? err.message : String(err));
  }
}
