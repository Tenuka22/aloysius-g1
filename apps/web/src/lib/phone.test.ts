import { describe, expect, it, test } from "vitest";
import { normalizeSriLankanMobile, isLikelySriLankanMobile } from "./phone";

describe("normalizeSriLankanMobile", () => {
  test.each([
    ["+940712345678", "+94712345678"],
    ["+9407123456789", "+947123456789"],
    ["0712345678", "+94712345678"],
    ["0761234567", "+94761234567"],
    ["077 123 4567", "+94771234567"],
    ["+94 (0)7 7123-4567", "+94771234567"],
    ["0234567890", "0234567890"],
    ["+910712345678", "+910712345678"],
    ["abcd", "abcd"],
    ["" , ""],
  ])("converts %s to %s", (input, expected) => expect(normalizeSriLankanMobile(input)).toBe(expected));

  it("keeps a 9-digit 07-prefixed number unchanged (too short)", () => expect(normalizeSriLankanMobile("071234567")).toBe("071234567"));
  it("keeps a 10-digit 07-prefixed number converted", () => expect(normalizeSriLankanMobile("0712345678")).toBe("+94712345678"));
});

describe("isLikelySriLankanMobile", () => {
  test.each([
    ["+94712345678", true],
    ["+94(0)711234567", true],
    ["0712345678", true],
    ["077 123 4567", true],
    ["+911234567890", false],
    ["9112345678", false],
    ["", false],
    [" ", false],
  ])("%s -> %s", (input, expected) => expect(isLikelySriLankanMobile(input)).toBe(expected));
});