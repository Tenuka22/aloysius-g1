import { describe, expect, it } from "vitest";
import { signInSchema, signUpSchema } from "./validation";

describe("signInSchema", () => {
  it("accepts valid credentials", () =>
    expect(signInSchema.safeParse({ email: "parent@example.com", password: "password123" }).success).toBe(true));
  it("rejects an invalid email", () =>
    expect(signInSchema.safeParse({ email: "not-an-email", password: "password123" }).success).toBe(false));
  it("rejects a short password", () =>
    expect(signInSchema.safeParse({ email: "parent@example.com", password: "short" }).success).toBe(false));
  it("rejects an empty email", () =>
    expect(signInSchema.safeParse({ email: "", password: "password123" }).success).toBe(false));
});

describe("signUpSchema", () => {
  it("accepts valid input", () =>
    expect(signUpSchema.safeParse({ name: "An", email: "parent@example.com", password: "password123" }).success).toBe(true));
  it("rejects a too-short name", () =>
    expect(signUpSchema.safeParse({ name: "A", email: "parent@example.com", password: "password123" }).success).toBe(false));
  it("rejects an invalid email", () =>
    expect(signUpSchema.safeParse({ name: "An", email: "nope", password: "password123" }).success).toBe(false));
  it("rejects a short password", () =>
    expect(signUpSchema.safeParse({ name: "An", email: "parent@example.com", password: "1234567" }).success).toBe(false));
});
