// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RESEND_COOLDOWN_SECONDS, useResendCooldown } from "./use-resend-cooldown";

describe("useResendCooldown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts idle with no cooldown by default", () => {
    const { result } = renderHook(() => useResendCooldown());
    expect(result.current.cooldown).toBe(0);
    expect(result.current.isCoolingDown).toBe(false);
    expect(typeof result.current.startCooldown).toBe("function");
  });

  it("honours a non-zero initial value", () => {
    const { result } = renderHook(() => useResendCooldown(30));
    expect(result.current.cooldown).toBe(30);
    expect(result.current.isCoolingDown).toBe(true);
  });

  it("counts down once per second until it reaches zero", () => {
    const { result } = renderHook(() => useResendCooldown(3));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.cooldown).toBe(2);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.cooldown).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.cooldown).toBe(0);
    expect(result.current.isCoolingDown).toBe(false);
  });

  it("stops counting at zero instead of going negative", () => {
    const { result } = renderHook(() => useResendCooldown(1));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.cooldown).toBe(0);
  });

  it("startCooldown defaults to the standard 60 second window", () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(60);
    const { result } = renderHook(() => useResendCooldown());
    act(() => {
      result.current.startCooldown();
    });
    expect(result.current.cooldown).toBe(RESEND_COOLDOWN_SECONDS);
    expect(result.current.isCoolingDown).toBe(true);
  });

  it("startCooldown accepts a custom duration", () => {
    const { result } = renderHook(() => useResendCooldown());
    act(() => {
      result.current.startCooldown(5);
    });
    expect(result.current.cooldown).toBe(5);
  });

  it("keeps startCooldown referentially stable across renders", () => {
    const { result, rerender } = renderHook(() => useResendCooldown());
    const first = result.current.startCooldown;
    rerender();
    expect(result.current.startCooldown).toBe(first);
  });

  it("can be restarted while a cooldown is already running", () => {
    const { result } = renderHook(() => useResendCooldown());
    act(() => {
      result.current.startCooldown(10);
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.cooldown).toBe(8);
    act(() => {
      result.current.startCooldown(4);
    });
    expect(result.current.cooldown).toBe(4);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.cooldown).toBe(0);
  });

  it("clears its interval on unmount", () => {
    const { result, unmount } = renderHook(() => useResendCooldown(5));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
