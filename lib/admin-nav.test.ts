import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { adminNav, adminPageLabel, adminRoleLabel, isActiveAdminPath } from "./admin-nav";

const hrefs = (superAdmin: boolean) => adminNav(superAdmin).flatMap((g) => g.items.map((i) => i.href));

describe("admin nav", () => {
  it("only offers staff management to super admins", () => {
    expect(hrefs(false)).not.toContain("/admin/management");
    expect(hrefs(true)).toContain("/admin/management");
  });

  it("points every item at a page that exists", () => {
    const root = join(import.meta.dirname, "..", "app", "(admin)");
    for (const href of hrefs(true)) {
      expect(existsSync(join(root, href, "page.tsx")), href).toBe(true);
    }
  });

  it("marks the dashboard active only on the dashboard", () => {
    expect(isActiveAdminPath("/admin", "/admin")).toBe(true);
    expect(isActiveAdminPath("/admin/members", "/admin")).toBe(false);
  });

  it("marks sections active on their sub-pages, not on lookalikes", () => {
    expect(isActiveAdminPath("/admin/approvals", "/admin/approvals")).toBe(true);
    expect(isActiveAdminPath("/admin/approvals/123", "/admin/approvals")).toBe(true);
    expect(isActiveAdminPath("/admin/approvalsx", "/admin/approvals")).toBe(false);
  });
});

describe("header labels", () => {
  it("names the current page", () => {
    expect(adminPageLabel("/admin")).toBe("Dashboard");
    expect(adminPageLabel("/admin/rooms")).toBe("Space management");
    expect(adminPageLabel("/admin/insights")).toBe("Insights");
    expect(adminPageLabel("/admin/management")).toBe("Staff management");
  });

  it("treats the old history link as Compliance, and falls back gracefully", () => {
    expect(adminPageLabel("/admin/history")).toBe("Compliance");
    expect(adminPageLabel("/admin/something-new")).toBe("Admin");
  });

  it("names the role", () => {
    expect(adminRoleLabel("super_admin")).toBe("Super admin");
    expect(adminRoleLabel("admin")).toBe("Admin");
    expect(adminRoleLabel(null)).toBe("Admin");
  });
});
