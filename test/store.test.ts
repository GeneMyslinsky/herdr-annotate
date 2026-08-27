import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendAnnotation,
  appendArchivedSet,
  loadAnnotations,
  loadArchivedSets,
  mergeAnnotations,
  newestFirstAnnotations,
  newestFirstArchivedSets,
  removeAnnotationsById,
  removeArchivedSet,
} from "../src/store";
import type { Annotation, ArchivedAnnotationSet } from "../src/types";

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

function archive(id: string, annotationIds: readonly string[]): ArchivedAnnotationSet {
  return {
    version: 1,
    id,
    archivedAt: `2026-08-26T23:32:0${id.length}Z`,
    annotations: annotationIds.map(annotation),
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

  test("removes only the requested annotation IDs", () => {
    const dir = temporaryDirectory();
    appendAnnotation(dir, annotation("one"));
    appendAnnotation(dir, annotation("two"));
    appendAnnotation(dir, annotation("three"));

    expect(removeAnnotationsById(dir, ["one", "three"]).ok).toBeTrue();
    const loaded = loadAnnotations(dir);
    expect(loaded.ok && loaded.value.map(({ id }) => id)).toEqual(["two"]);
    expect(removeAnnotationsById(dir, ["two"]).ok).toBeTrue();
    const cleared = loadAnnotations(dir);
    expect(cleared.ok && cleared.value).toEqual([]);
  });

  test("merges restored annotations without duplicate IDs", () => {
    const dir = temporaryDirectory();
    appendAnnotation(dir, annotation("one"));

    const merged = mergeAnnotations(dir, [annotation("one"), annotation("two")]);
    expect(merged).toEqual({ ok: true, value: 1 });
    expect(loadAnnotations(dir)).toEqual({
      ok: true,
      value: [annotation("one"), annotation("two")],
    });

    expect(removeAnnotationsById(dir, ["one"]).ok).toBeTrue();
    expect(loadAnnotations(dir)).toEqual({ ok: true, value: [annotation("two")] });
  });

  test("rejects malformed active data instead of dropping it", () => {
    const dir = temporaryDirectory();
    fs.writeFileSync(path.join(dir, "annotations.jsonl"), "{broken\n");
    expect(loadAnnotations(dir)).toEqual({
      ok: false,
      message: "Unable to read annotations (invalid data)",
    });
  });

  test("fails safely on contention and recovers an abandoned lock", () => {
    const dir = temporaryDirectory();
    const lock = path.join(dir, ".annotations.lock");
    fs.mkdirSync(lock);

    expect(appendAnnotation(dir, annotation("one"))).toEqual({
      ok: false,
      message: "Annotations are busy; try again.",
    });
    expect(loadAnnotations(dir)).toEqual({
      ok: false,
      message: "Annotations are busy; try again.",
    });

    const stale = new Date(Date.now() - 31_000);
    fs.utimesSync(lock, stale, stale);
    expect(appendAnnotation(dir, annotation("one")).ok).toBeTrue();
    expect(loadAnnotations(dir)).toEqual({ ok: true, value: [annotation("one")] });
  });
});

describe("archive store", () => {
  test("persists complete sets and presents the newest archive first", () => {
    const dir = temporaryDirectory();
    const first = archive("one", ["annotation-one"]);
    const second = archive("two", ["annotation-two", "annotation-three"]);

    expect(appendArchivedSet(dir, first).ok).toBeTrue();
    expect(appendArchivedSet(dir, second).ok).toBeTrue();
    const loaded = loadArchivedSets(dir);
    expect(loaded).toEqual({ ok: true, value: [first, second] });
    expect(loaded.ok && newestFirstArchivedSets(loaded.value).map(({ id }) => id)).toEqual([
      "two",
      "one",
    ]);
  });

  test("permanently removes only the selected archived set", () => {
    const dir = temporaryDirectory();
    appendArchivedSet(dir, archive("one", ["annotation-one"]));
    appendArchivedSet(dir, archive("two", ["annotation-two"]));

    expect(removeArchivedSet(dir, "one").ok).toBeTrue();
    const loaded = loadArchivedSets(dir);
    expect(loaded.ok && loaded.value.map(({ id }) => id)).toEqual(["two"]);
  });

  test("rejects malformed archive data instead of partially loading it", () => {
    const dir = temporaryDirectory();
    fs.writeFileSync(path.join(dir, "archives.jsonl"), "{broken\n");
    expect(loadArchivedSets(dir)).toEqual({
      ok: false,
      message: "Unable to read archives (invalid data)",
    });
  });
});
