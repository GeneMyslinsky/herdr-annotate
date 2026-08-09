import { describe, expect, test } from "bun:test";
import { formatAnnotations, sanitizeTerminalText, wrapText } from "../src/format";
import { parseAnnotation, parsePendingAnnotation } from "../src/types";

describe("wrapText", () => {
  test("wraps and preserves explicit newlines", () => {
    expect(wrapText("abcdef\nxy", 3)).toEqual(["abc", "def", "xy"]);
  });
});

test("terminal display strips control characters", () => {
  expect(sanitizeTerminalText("safe\u001b[2J\ttext\nnext")).toBe("safe[2J    text\nnext");
});

describe("persisted annotation parsing", () => {
  test("rejects malformed boundary input", () => {
    expect(parsePendingAnnotation({ selectedText: 42 })).toBeUndefined();
    expect(parseAnnotation({ selectedText: "text", capturedAt: "now", context: {} })).toBeUndefined();
  });
});

describe("formatAnnotations", () => {
  test("formats source, selection, and comment as agent context", () => {
    const output = formatAnnotations([
      {
        id: "one",
        selectedText: "failed to connect",
        comment: "Check the database first.",
        capturedAt: "2026-08-08T00:00:00Z",
        createdAt: "2026-08-08T00:00:01Z",
        context: { workspace_label: "api", tab_label: "server" },
      },
    ]);
    expect(output).toContain("# Annotated context");
    expect(output).toContain("Source: api / server");
    expect(output).toContain("failed to connect");
    expect(output).toContain("Check the database first.");
  });

  test("uses a longer fence when the selection contains backticks", () => {
    const output = formatAnnotations([
      {
        id: "one",
        selectedText: "```example```",
        comment: "Fence safely.",
        capturedAt: "2026-08-08T00:00:00Z",
        createdAt: "2026-08-08T00:00:01Z",
        context: {},
      },
    ]);
    expect(output).toContain("````\n```example```\n````");
  });
});
