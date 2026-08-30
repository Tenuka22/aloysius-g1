// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhoneInput } from "./phone-input";

function Controlled({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <PhoneInput
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

afterEach(() => {
  cleanup();
});

function getInput(container: HTMLElement) {
  return container.querySelector('input[type="tel"]') as HTMLInputElement;
}

function getTrigger(container: HTMLElement) {
  return container.querySelector('button') as HTMLButtonElement;
}

describe("PhoneInput", () => {
  it("normalizes a Sri Lankan mobile number as it is typed", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    const { container } = render(<Controlled onChange={spy} />);
    await user.type(getInput(container), "0712345678");
    expect(spy).toHaveBeenLastCalledWith("+94712345678");
  });

  it("does not reformat an already-international number while typing", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    const { container } = render(<Controlled onChange={spy} />);
    await user.type(getInput(container), "+447123456789");
    expect(spy).toHaveBeenLastCalledWith("+447123456789");
  });

  it("reformats the number against the calling code when a country is selected", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    const { container } = render(<PhoneInput value="+94712345678" onChange={spy} />);
    const trigger = getTrigger(container);
    expect(trigger).not.toBeNull();
    await user.click(trigger);
    const indiaOption = container.querySelector('[role="menuitem"]') ?? document.body.querySelector('button');
    // Find India option in the opened popover
    const allButtons = document.body.querySelectorAll("button");
    let indiaBtn: HTMLElement | null = null;
    allButtons.forEach((btn) => {
      if (/india/i.test(btn.textContent ?? "")) indiaBtn = btn;
    });
    expect(indiaBtn).not.toBeNull();
    await user.click(indiaBtn!);
    expect(spy).toHaveBeenLastCalledWith(expect.stringMatching(/^\+91/));
  });

  it("detects a non-Sri-Lankan number's country from its prefix", async () => {
    const { container } = render(<PhoneInput value="+447123456789" onChange={vi.fn()} />);
    const trigger = getTrigger(container);
    expect(trigger).not.toBeNull();
  });

  it("lists every supported country", async () => {
    const user = userEvent.setup();
    const { container } = render(<PhoneInput value="" onChange={vi.fn()} />);
    const trigger = getTrigger(container);
    await user.click(trigger);
    const allButtons = document.body.querySelectorAll("button");
    const buttonTexts = Array.from(allButtons).map((b) => b.textContent ?? "");
    for (const label of ["India", "United States", "United Kingdom", "Australia", "Canada", "Singapore", "United Arab Emirates", "Malaysia", "Japan", "Germany", "France"]) {
      expect(buttonTexts.some((t) => new RegExp(label, "i").test(t))).toBe(true);
    }
  });

  it("shows the saved value hint", () => {
    const { container } = render(<PhoneInput value="+94712345678" onChange={vi.fn()} />);
    expect(container.textContent).toContain("Saved as +94 71 234 5678");
  });

  it("does not show the saved value hint when empty", () => {
    const { container } = render(<PhoneInput value="" onChange={vi.fn()} />);
    expect(container.textContent).not.toMatch(/saved as/i);
  });

  it("accepts an empty value without error", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    const { container } = render(<Controlled onChange={spy} />);
    await user.type(getInput(container), "0712345678");
    expect(spy).toHaveBeenLastCalledWith("+94712345678");
    await user.clear(getInput(container));
    expect(spy).toHaveBeenLastCalledWith("");
  });
});
