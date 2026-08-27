import { describe, expect, test } from "bun:test";
import { copyAnnotations } from "../src/manager-copy";
import type { Annotation } from "../src/types";

function annotation(id: string): Annotation {
  return {
    id,
    selectedText: `selection ${id}`,
    comment: `comment ${id}`,
    capturedAt: "2026-08-08T00:00:00Z",
    createdAt: "2026-08-08T00:00:01Z",
    context: {},
  };
}

describe("annotation manager copying", () => {
  test("closes after a successful copy without changing annotations", () => {
    const annotations = [annotation("one"), annotation("two")];
    const original = structuredClone(annotations);
    let clipboardText = "";

    const outcome = copyAnnotations(annotations, (text) => {
      clipboardText = text;
      return { ok: true, value: undefined };
    });

    expect(outcome).toEqual({ _tag: "close" });
    expect(clipboardText).toContain("selection one");
    expect(clipboardText).toContain("selection two");
    expect(annotations).toEqual(original);
  });

  test("stays open and reports a clipboard failure", () => {
    const outcome = copyAnnotations([annotation("one")], () => ({
      ok: false,
      message: "Clipboard unavailable",
    }));

    expect(outcome).toEqual({ _tag: "stay_open", message: "Clipboard unavailable" });
  });

  test("stays open when there is nothing to copy", () => {
    let writes = 0;
    const outcome = copyAnnotations([], () => {
      writes += 1;
      return { ok: true, value: undefined };
    });

    expect(outcome).toEqual({ _tag: "stay_open", message: "Nothing to copy." });
    expect(writes).toBe(0);
  });
});
