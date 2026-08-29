import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The database and the TypeScript both declare what a `kind` or a `space_group` may
 * be -- the migration as a CHECK constraint, the map as a union type. Nothing forces
 * them to agree, and if they drift the failure is nasty: the app offers a value the
 * database refuses, and the insert fails at runtime for whoever tried it.
 *
 * These tests read the actual migration file and the actual type definitions and
 * compare them, so drift fails here instead of in production.
 */

const ROOT = join(import.meta.dirname, "..");

const migration = readFileSync(
  join(ROOT, "supabase/migrations/add_floorplan_space_columns.sql"),
  "utf8",
);
const types = readFileSync(
  join(ROOT, "features/booking-map/booking/types.ts"),
  "utf8",
);

/** Pull the quoted values out of a named CHECK constraint in the migration. */
function checkValues(constraint: string): string[] {
  const block = migration.split(`conname = '${constraint}'`)[1];
  if (!block) throw new Error(`no constraint named ${constraint} in the migration`);
  const inClause = block.match(/in \(([\s\S]*?)\)/);
  if (!inClause) throw new Error(`constraint ${constraint} has no IN (...) list`);
  return [...inClause[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
}

/** Pull the members out of a TypeScript string-union type. */
function unionMembers(name: string): string[] {
  const decl = types.split(`export type ${name} =`)[1];
  if (!decl) throw new Error(`no type named ${name}`);
  const body = decl.split(";")[0];
  return [...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
}

describe("kind vocabulary", () => {
  it("is identical in the migration and the TypeScript", () => {
    expect(checkValues("workspaces_kind_check")).toEqual(unionMembers("SpaceKind"));
  });

  it("is not empty", () => {
    expect(checkValues("workspaces_kind_check").length).toBeGreaterThan(0);
  });
});

describe("space_group vocabulary", () => {
  it("is identical in the migration and the TypeScript", () => {
    expect(checkValues("workspaces_space_group_check")).toEqual(unionMembers("SpaceGroup"));
  });
});

describe("migration safety properties", () => {
  it("adds every column with IF NOT EXISTS, so re-running is harmless", () => {
    const adds = [...migration.matchAll(/add column(?! if not exists)/gi)];
    expect(adds, "an `add column` without IF NOT EXISTS makes the migration non-idempotent").toEqual([]);
  });

  it("is wrapped in a transaction", () => {
    expect(migration).toMatch(/^\s*begin;/m);
    expect(migration).toMatch(/^\s*commit;/m);
  });

  it("adds no NOT NULL column without a default", () => {
    // A NOT NULL column with no default fails immediately against existing rows.
    const bad = [...migration.matchAll(/add column if not exists\s+\w+\s+[\w()]+\s+not null(?!\s+default)/gi)];
    expect(bad.map((m) => m[0])).toEqual([]);
  });

  it("does not drop or delete anything", () => {
    // Phase 2 is purely additive; a drop here would be a mistake, not a feature.
    expect(migration).not.toMatch(/\bdrop\s+(table|column)\b/i);
    expect(migration).not.toMatch(/\bdelete\s+from\b/i);
  });

  it("leaves floorplan_id nullable so undrawn rooms stay bookable", () => {
    expect(migration).toMatch(/add column if not exists floorplan_id text,/);
    expect(migration).not.toMatch(/floorplan_id text not null/i);
  });

  it("makes the floorplan_id index unique but partial", () => {
    // Unique so one plan position holds one space; partial so the many rooms with
    // no position yet don't all collide on null.
    expect(migration).toMatch(/create unique index if not exists workspaces_floorplan_id_key/i);
    expect(migration).toMatch(/where floorplan_id is not null/i);
  });
});
