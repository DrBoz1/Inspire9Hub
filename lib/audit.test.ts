import { describe, expect, it } from "vitest";
import { auditRow } from "./audit";

describe("audit row", () => {
  it("maps an entry onto the table's column names", () => {
    expect(
      auditRow({
        actor: { id: "a1", email: "sam@inspire9.com" },
        action: "booking.cancel",
        entity: "booking",
        entityId: "b1",
        summary: "Cancelled Dream Room, Tue 16 Sep 9am – 11am",
        meta: { refunded: false },
      }),
    ).toEqual({
      actor_id: "a1",
      actor_email: "sam@inspire9.com",
      action: "booking.cancel",
      entity: "booking",
      entity_id: "b1",
      summary: "Cancelled Dream Room, Tue 16 Sep 9am – 11am",
      meta: { refunded: false },
    });
  });

  it("normalises the actor email so the same person always reads the same", () => {
    expect(auditRow({ actor: { id: "a1", email: " Sam@Inspire9.com " }, action: "room.update", entity: "room", summary: "x" }).actor_email).toBe(
      "sam@inspire9.com",
    );
  });

  it("keeps the row valid when the optional parts are missing", () => {
    const row = auditRow({ actor: null, action: "staff.remove_stale", entity: "staff", summary: "  Cleared 2 stale records  " });
    // A null actor is a real case: the stale-record cleanup runs against logins
    // that no longer exist, and an empty email must not read as the string "".
    expect(row).toEqual({
      actor_id: null,
      actor_email: null,
      action: "staff.remove_stale",
      entity: "staff",
      entity_id: null,
      summary: "Cleared 2 stale records",
      meta: {},
    });
  });

  it("treats a blank email as absent rather than storing an empty string", () => {
    expect(auditRow({ actor: { id: "a1", email: "   " }, action: "room.update", entity: "room", summary: "x" }).actor_email).toBeNull();
  });
});
