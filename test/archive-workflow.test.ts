import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { copyAndArchiveAnnotations, restoreArchivedSet } from "../src/archive-workflow";
import {
  appendAnnotation,
  appendArchivedSet,
  loadAnnotations,
  loadArchivedSets,
  mergeAnnotations,
  removeAnnotationsById,
  removeArchivedSet,
} from "../src/store";
import type { Annotation, ArchivedAnnotationSet } from "../src/types";

const directories: string[] = [];

function temporaryDirectory(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "herdr-annotate-workflow-"));
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

function archive(annotationIds: readonly string[]): ArchivedAnnotationSet {
  return {
    version: 1,
    id: "archive-one",
    archivedAt: "2026-08-26T23:32:00Z",
    annotations: annotationIds.map(annotation),
  };
}

afterEach(() => {
  for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("copy and archive", () => {
  test("copies newest first, saves the complete set, then removes active IDs", () => {
    const active = [annotation("one"), annotation("two")];
    const events: string[] = [];
    let clipboardText = "";
    let savedArchive: ArchivedAnnotationSet | undefined;
    let removedIds: readonly string[] = [];

    const outcome = copyAndArchiveAnnotations({
      loadActive: () => {
        events.push("load");
        return { ok: true, value: active };
      },
      writeClipboard: (text) => {
        events.push("copy");
        clipboardText = text;
        return { ok: true, value: undefined };
      },
      saveArchive: (saved) => {
        events.push("archive");
        savedArchive = saved;
        return { ok: true, value: undefined };
      },
      removeActive: (ids) => {
        events.push("remove");
        removedIds = ids;
        return { ok: true, value: undefined };
      },
      createArchiveId: () => "archive-one",
      now: () => "2026-08-26T23:32:00Z",
    });

    expect(outcome).toEqual({ _tag: "close", archivedCount: 2 });
    expect(events).toEqual(["load", "copy", "archive", "remove"]);
    expect(clipboardText.indexOf("selection two")).toBeLessThan(
      clipboardText.indexOf("selection one"),
    );
    expect(savedArchive).toEqual(archive(["one", "two"]));
    expect(removedIds).toEqual(["one", "two"]);
  });

  test("does not archive or clear when clipboard writing fails", () => {
    const events: string[] = [];
    const outcome = copyAndArchiveAnnotations({
      loadActive: () => ({ ok: true, value: [annotation("one")] }),
      writeClipboard: () => ({ ok: false, message: "Clipboard unavailable" }),
      saveArchive: () => {
        events.push("archive");
        return { ok: true, value: undefined };
      },
      removeActive: () => {
        events.push("remove");
        return { ok: true, value: undefined };
      },
      createArchiveId: () => "archive-one",
      now: () => "2026-08-26T23:32:00Z",
    });

    expect(outcome).toEqual({ _tag: "stay_open", message: "Clipboard unavailable" });
    expect(events).toEqual([]);
  });

  test("does not clear active annotations when archive storage fails", () => {
    let removed = false;
    const outcome = copyAndArchiveAnnotations({
      loadActive: () => ({ ok: true, value: [annotation("one")] }),
      writeClipboard: () => ({ ok: true, value: undefined }),
      saveArchive: () => ({ ok: false, message: "Archive unavailable" }),
      removeActive: () => {
        removed = true;
        return { ok: true, value: undefined };
      },
      createArchiveId: () => "archive-one",
      now: () => "2026-08-26T23:32:00Z",
    });

    expect(outcome).toEqual({ _tag: "stay_open", message: "Archive unavailable" });
    expect(removed).toBeFalse();
  });

  test("reports that active data remains when clearing fails after archival", () => {
    let archived = false;
    const outcome = copyAndArchiveAnnotations({
      loadActive: () => ({ ok: true, value: [annotation("one")] }),
      writeClipboard: () => ({ ok: true, value: undefined }),
      saveArchive: () => {
        archived = true;
        return { ok: true, value: undefined };
      },
      removeActive: () => ({ ok: false, message: "Active store unavailable" }),
      createArchiveId: () => "archive-one",
      now: () => "2026-08-26T23:32:00Z",
    });

    expect(archived).toBeTrue();
    expect(outcome).toEqual({
      _tag: "archived_active_retained",
      message: "Active store unavailable",
    });
  });
});

describe("restore archive", () => {
  test("merges annotations before removing the archived set", () => {
    const events: string[] = [];
    const outcome = restoreArchivedSet(archive(["one", "two"]), {
      mergeActive: () => {
        events.push("merge");
        return { ok: true, value: 2 };
      },
      removeArchive: () => {
        events.push("remove");
        return { ok: true, value: undefined };
      },
    });

    expect(outcome).toEqual({ _tag: "restored", restoredCount: 2 });
    expect(events).toEqual(["merge", "remove"]);
  });

  test("keeps the archive when restoring active annotations fails", () => {
    let removed = false;
    const outcome = restoreArchivedSet(archive(["one"]), {
      mergeActive: () => ({ ok: false, message: "Active store unavailable" }),
      removeArchive: () => {
        removed = true;
        return { ok: true, value: undefined };
      },
    });

    expect(outcome).toEqual({ _tag: "stay_open", message: "Active store unavailable" });
    expect(removed).toBeFalse();
  });

  test("reports a retained archive after active annotations were restored", () => {
    const outcome = restoreArchivedSet(archive(["one"]), {
      mergeActive: () => ({ ok: true, value: 1 }),
      removeArchive: () => ({ ok: false, message: "Archive unavailable" }),
    });

    expect(outcome).toEqual({
      _tag: "restored_archive_retained",
      restoredCount: 1,
      message: "Archive unavailable",
    });
  });
});

test("archives, clears, and restores a set through the real stores", () => {
  const dir = temporaryDirectory();
  appendAnnotation(dir, annotation("one"));
  appendAnnotation(dir, annotation("two"));

  const archived = copyAndArchiveAnnotations({
    loadActive: () => loadAnnotations(dir),
    writeClipboard: () => ({ ok: true, value: undefined }),
    saveArchive: (set) => appendArchivedSet(dir, set),
    removeActive: (ids) => removeAnnotationsById(dir, ids),
    createArchiveId: () => "archive-one",
    now: () => "2026-08-26T23:32:00Z",
  });

  expect(archived).toEqual({ _tag: "close", archivedCount: 2 });
  expect(loadAnnotations(dir)).toEqual({ ok: true, value: [] });
  const storedArchives = loadArchivedSets(dir);
  expect(storedArchives.ok && storedArchives.value.map(({ id }) => id)).toEqual(["archive-one"]);
  if (!storedArchives.ok) return;
  const storedArchive = storedArchives.value[0];
  if (!storedArchive) return;

  const restored = restoreArchivedSet(storedArchive, {
    mergeActive: (items) => mergeAnnotations(dir, items),
    removeArchive: (archiveId) => removeArchivedSet(dir, archiveId),
  });

  expect(restored).toEqual({ _tag: "restored", restoredCount: 2 });
  const active = loadAnnotations(dir);
  expect(active.ok && active.value.map(({ id }) => id)).toEqual(["one", "two"]);
  expect(loadArchivedSets(dir)).toEqual({ ok: true, value: [] });
});

test("copy and archive preserves an annotation saved after the active snapshot", () => {
  const dir = temporaryDirectory();
  appendAnnotation(dir, annotation("snapshot"));

  const outcome = copyAndArchiveAnnotations({
    loadActive: () => loadAnnotations(dir),
    writeClipboard: () => ({ ok: true, value: undefined }),
    saveArchive: (set) => {
      const saved = appendArchivedSet(dir, set);
      if (!saved.ok) return saved;
      return appendAnnotation(dir, annotation("concurrent"));
    },
    removeActive: (ids) => removeAnnotationsById(dir, ids),
    createArchiveId: () => "archive-one",
    now: () => "2026-08-26T23:32:00Z",
  });

  expect(outcome).toEqual({ _tag: "close", archivedCount: 1 });
  expect(loadAnnotations(dir)).toEqual({ ok: true, value: [annotation("concurrent")] });
  const storedArchives = loadArchivedSets(dir);
  expect(
    storedArchives.ok && storedArchives.value[0]?.annotations.map(({ id }) => id),
  ).toEqual(["snapshot"]);
});
