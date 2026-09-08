// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Account = { providerId: string };

const mockState = vi.hoisted(() => ({
  allowPasswordless: false,
  accounts: [] as Account[] | undefined,
  isPending: false,
}));

vi.mock("@better-auth-ui/react", () => ({
  useAuth: () => ({ authClient: {} }),
  useAuthPlugin: () => ({ allowPasswordless: mockState.allowPasswordless }),
  useListAccounts: (_client: unknown) => ({ data: mockState.accounts, isPending: mockState.isPending }),
}));

vi.mock("./two-factor-plugin", () => ({ twoFactorPlugin: { id: "twoFactor" } }));

import { useTwoFactorPasswordRequirement } from "./use-two-factor-password";

beforeEach(() => {
  mockState.allowPasswordless = false;
  mockState.accounts = [];
  mockState.isPending = false;
});

describe("useTwoFactorPasswordRequirement", () => {
  it("always requires a password when allowPasswordless is off", () => {
    mockState.accounts = [];
    const { result } = renderHook(() => useTwoFactorPasswordRequirement());
    expect(result.current.requiresPassword).toBe(true);
    expect(result.current.isPending).toBe(false);
  });

  it("requires a password while the account list is loading", () => {
    mockState.allowPasswordless = true;
    mockState.isPending = true;
    mockState.accounts = undefined;
    const { result } = renderHook(() => useTwoFactorPasswordRequirement());
    expect(result.current.requiresPassword).toBe(true);
    expect(result.current.isPending).toBe(true);
  });

  it("requires a password when a credential account exists", () => {
    mockState.allowPasswordless = true;
    mockState.accounts = [{ providerId: "credential" }];
    const { result } = renderHook(() => useTwoFactorPasswordRequirement());
    expect(result.current.requiresPassword).toBe(true);
  });

  it("waives the password for a passkey-only account when passwordless is allowed", () => {
    mockState.allowPasswordless = true;
    mockState.accounts = [{ providerId: "passkey" }];
    const { result } = renderHook(() => useTwoFactorPasswordRequirement());
    expect(result.current.requiresPassword).toBe(false);
    expect(result.current.isPending).toBe(false);
  });

  it("waives the password for an empty account list once it resolves", () => {
    // An empty resolved list means no credential account exists - the same
    // condition that lets a passkey-only user skip the password field.
    mockState.allowPasswordless = true;
    mockState.accounts = [];
    const { result } = renderHook(() => useTwoFactorPasswordRequirement());
    expect(result.current.requiresPassword).toBe(false);
  });

  it("defaults to requiring a password while loading, then re-evaluates once resolved", async () => {
    mockState.allowPasswordless = true;
    mockState.isPending = true;
    mockState.accounts = undefined;
    const { result, rerender } = renderHook(() => useTwoFactorPasswordRequirement());
    expect(result.current.requiresPassword).toBe(true);
    // Once the list resolves with no credential account, the requirement lifts.
    mockState.isPending = false;
    mockState.accounts = [{ providerId: "passkey" }];
    rerender();
    await waitFor(() => expect(result.current.requiresPassword).toBe(false));
  });

  it("isPending mirrors allowPasswordless", () => {
    mockState.allowPasswordless = false;
    mockState.isPending = true;
    const { result } = renderHook(() => useTwoFactorPasswordRequirement());
    expect(result.current.isPending).toBe(false);
  });
});
