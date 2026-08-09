import { describe, expect, test } from "bun:test";
import { selectedTextFromInvocation } from "../src/types";

describe("selectedTextFromInvocation", () => {
  test("returns Herdr's terminal selection without changing it", () => {
    expect(selectedTextFromInvocation({ selected_text: "  selected text\n" })).toBe(
      "  selected text\n",
    );
  });

  test("ignores missing, invalid, and empty selections", () => {
    expect(selectedTextFromInvocation({})).toBeUndefined();
    expect(selectedTextFromInvocation({ selected_text: 42 })).toBeUndefined();
    expect(selectedTextFromInvocation({ selected_text: " \n\t" })).toBeUndefined();
    expect(selectedTextFromInvocation(null)).toBeUndefined();
  });
});
