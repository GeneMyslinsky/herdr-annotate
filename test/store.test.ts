import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendAnnotation,
  loadAnnotations,
  newestFirstAnnotations,
  replaceAnnotations,
} from "../src/store";
import type { Annotation } from "../src/types";

const directories: string[] = [];

function temporaryDirectory(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "herdr-annotate-store-"));
  directories.push(dir);
  return dir;
}

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

afterEach(() => {
  for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("annotation store", () => {
  test("presents the newest appended annotation first without mutating storage order", () => {
    const stored = [annotation("one"), annotation("two"), annotation("three")];
    expect(newestFirstAnnotations(stored).map(({ id }) => id)).toEqual(["three", "two", "one"]);
    expect(stored.map(({ id }) => id)).toEqual(["one", "two", "three"]);
  });

  test("appends and loads records", () => {
    const dir = temporaryDirectory();
    expect(appendAnnotation(dir, annotation("one")).ok).toBeTrue();
    expect(appendAnnotation(dir, annotation("two")).ok).toBeTrue();
    const loaded = loadAnnotations(dir);
    expect(loaded.ok && loaded.value.map(({ id }) => id)).toEqual(["one", "two"]);
  });

  test("atomically replaces or clears records", () => {
    const dir = temporaryDirectory();
    appendAnnotation(dir, annotation("one"));
    expect(replaceAnnotations(dir, [annotation("two")]).ok).toBeTrue();
    let loaded = loadAnnotations(dir);
    expect(loaded.ok && loaded.value.map(({ id }) => id)).toEqual(["two"]);
    expect(replaceAnnotations(dir, []).ok).toBeTrue();
    loaded = loadAnnotations(dir);
    expect(loaded.ok && loaded.value).toEqual([]);
  });
});
