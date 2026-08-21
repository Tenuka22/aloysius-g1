// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("PhoneInput", () => {
  it("normalizes a Sri Lankan mobile number as it is typed", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Controlled onChange={spy} />);
    await user.type(screen.getByPlaceholderText("Contact phone number"), "0712345678");
    expect(spy).toHaveBeenLastCalledWith("+94712345678");
  });

  it("does not reformat an already-international number while typing", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Controlled onChange={spy} />);
    await user.type(screen.getByPlaceholderText("Contact phone number"), "+447123456789");
    expect(spy).toHaveBeenLastCalledWith("+447123456789");
  });

  it("reformats the number against the calling code when a country is selected", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<PhoneInput value="+94712345678" onChange={spy} />);
    expect(screen.getByRole("button", { name: /sri lanka/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /sri lanka/i }));
    await user.click(screen.getByRole("button", { name: /india/i }));
    expect(spy).toHaveBeenLastCalledWith(expect.stringMatching(/^\+91/));
  });

  it("detects a non-Sri-Lankan number's country from its prefix", async () => {
    render(<PhoneInput value="+447123456789" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /united kingdom/i })).toBeInTheDocument();
  });

  it("lists every supported country", async () => {
    const user = userEvent.setup();
    render(<PhoneInput value="" onChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /sri lanka/i }));
    for (const label of ["India", "United States", "United Kingdom", "Australia", "Canada", "Singapore", "United Arab Emirates", "Malaysia", "Japan", "Germany", "France"]) {
      expect(screen.getByRole("button", { name: new RegExp(label, "i") })).toBeInTheDocument();
    }
  });

  it("shows the saved value hint", () => {
    render(<PhoneInput value="+94712345678" onChange={vi.fn()} />);
    expect(screen.getByText("Saved as +94 712 345 678")).toBeInTheDocument();
  });

  it("does not show the saved value hint when empty", () => {
    render(<PhoneInput value="" onChange={vi.fn()} />);
    expect(screen.queryByText(/saved as/i)).not.toBeInTheDocument();
  });

  it("accepts an empty value without error", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Controlled onChange={spy} />);
    await user.type(screen.getByPlaceholderText("Contact phone number"), "0712345678");
    expect(spy).toHaveBeenLastCalledWith("+94712345678");
    await user.clear(screen.getByPlaceholderText("Contact phone number"));
    expect(spy).toHaveBeenLastCalledWith("");
  });
});