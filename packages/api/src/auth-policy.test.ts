import { describe, expect, it, test } from "vitest";
import { hasAdminRole } from "./auth-policy";

describe("hasAdminRole", () => {
  it("accepts an admin user", () => expect(hasAdminRole({ role: "admin" })).toBe(true));
  it("rejects a regular user", () => expect(hasAdminRole({ role: "user" })).toBe(false));
  test.each([
    ["null user", null],
    ["undefined user", undefined],
    ["user without a role", {}],
    ["empty role", { role: "" }],
    ["null role", { role: null }],
    ["different-case role", { role: "Admin" }],
  ])("rejects %s", (_label, user) => expect(hasAdminRole(user)).toBe(false));
});