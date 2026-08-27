import { describe, expect, test } from "bun:test";
import { parseArchivedAnnotationSet, selectedTextFromInvocation } from "../src/types";

function persistedAnnotation(id: string): Record<string, unknown> {
  return {
    id,
    selectedText: `selection ${id}`,
    comment: `comment ${id}`,
    capturedAt: "2026-08-08T00:00:00Z",
    createdAt: "2026-08-08T00:00:01Z",
    context: {},
  };
}

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

describe("parseArchivedAnnotationSet", () => {
  test("parses a complete versioned archive", () => {
    const parsed = parseArchivedAnnotationSet({
      version: 1,
      id: "archive-one",
      archivedAt: "2026-08-26T23:32:00Z",
      annotations: [persistedAnnotation("one")],
    });

    expect(parsed?.id).toBe("archive-one");
    expect(parsed?.annotations.map(({ id }) => id)).toEqual(["one"]);
  });

  test("rejects empty, partial, and unknown archive versions", () => {
    expect(
      parseArchivedAnnotationSet({
        version: 1,
        id: "empty",
        archivedAt: "2026-08-26T23:32:00Z",
        annotations: [],
      }),
    ).toBeUndefined();
    expect(
      parseArchivedAnnotationSet({
        version: 1,
        id: "partial",
        archivedAt: "2026-08-26T23:32:00Z",
        annotations: [persistedAnnotation("one"), { id: "broken" }],
      }),
    ).toBeUndefined();
    expect(
      parseArchivedAnnotationSet({
        version: 2,
        id: "future",
        archivedAt: "2026-08-26T23:32:00Z",
        annotations: [persistedAnnotation("one")],
      }),
    ).toBeUndefined();
  });
});
