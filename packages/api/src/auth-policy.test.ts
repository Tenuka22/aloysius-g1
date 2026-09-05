import { describe, expect, it, test } from "vitest";
import { hasAdminRole, hasSubAdminRole } from "./auth-policy";

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

describe("hasSubAdminRole", () => {
  it("accepts an admin user", () => expect(hasSubAdminRole({ role: "admin" })).toBe(true));
  it("accepts a sub-admin user", () => expect(hasSubAdminRole({ role: "sub-admin" })).toBe(true));
  it("rejects a regular user", () => expect(hasSubAdminRole({ role: "user" })).toBe(false));
  test.each([
    ["null user", null],
    ["undefined user", undefined],
    ["user without a role", {}],
    ["empty role", { role: "" }],
    ["null role", { role: null }],
    ["different-case role", { role: "Sub-Admin" }],
    ["unrelated role", { role: "editor" }],
  ])("rejects %s", (_label, user) => expect(hasSubAdminRole(user)).toBe(false));
});