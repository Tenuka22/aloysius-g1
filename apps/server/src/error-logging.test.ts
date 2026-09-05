import { describe, expect, it, vi } from "vitest";
import { ORPCError } from "@orpc/client";
import { logUnexpectedError } from "./error-logging";

describe("logUnexpectedError", () => {
  it("logs a plain, unclassified thrown error", () => {
    const log = vi.fn();
    const error = new Error("boom");
    logUnexpectedError(error, log);
    expect(log).toHaveBeenCalledWith(error);
  });

  it("logs an ORPCError with a 5xx server status", () => {
    const log = vi.fn();
    const error = new ORPCError("INTERNAL_SERVER_ERROR", { message: "db unavailable" });
    logUnexpectedError(error, log);
    expect(log).toHaveBeenCalledWith(error);
  });

  it.each([
    ["NOT_FOUND", 404],
    ["BAD_REQUEST", 400],
    ["UNAUTHORIZED", 401],
    ["FORBIDDEN", 403],
    ["CONFLICT", 409],
  ] as const)("does not log an expected %s (%d) client error", (code) => {
    const log = vi.fn();
    const error = new ORPCError(code);
    logUnexpectedError(error, log);
    expect(log).not.toHaveBeenCalled();
  });

  it("defaults to console.error when no logger is supplied", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("boom");
    logUnexpectedError(error);
    expect(spy).toHaveBeenCalledWith(error);
    spy.mockRestore();
  });
});
