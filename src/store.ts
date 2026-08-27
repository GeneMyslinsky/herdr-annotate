import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { annotationsPath, archivesPath } from "./paths";
import {
  parseAnnotation,
  parseArchivedAnnotationSet,
  type Annotation,
  type ArchivedAnnotationSet,
} from "./types";

type StoreName = "annotations" | "archives";

type LockCreation =
  | { readonly _tag: "acquired" }
  | { readonly _tag: "exists" }
  | { readonly _tag: "error"; readonly message: string };

interface StoreLockLease {
  readonly path: string;
  readonly owner: string;
}

const staleLockMilliseconds = 30_000;

/** The result of an expected annotation-store operation. */
export type StoreResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

/** Present append-ordered annotations with the most recently saved first. */
export function newestFirstAnnotations(annotations: readonly Annotation[]): Annotation[] {
  return annotations.slice().reverse();
}

/** Load the complete active store, rejecting malformed records instead of dropping data. */
export function loadAnnotations(dir: string): StoreResult<Annotation[]> {
  return withStoreLock(dir, "annotations", () => loadAnnotationsUnlocked(dir));
}

/** Append one annotation without rewriting existing records. */
export function appendAnnotation(dir: string, annotation: Annotation): StoreResult<undefined> {
  return withStoreLock(dir, "annotations", () => {
    try {
      fs.appendFileSync(annotationsPath(dir), `${JSON.stringify(annotation)}\n`, { mode: 0o600 });
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, message: safeFileError("Unable to save annotation", error) };
    }
  });
}

/** Remove selected annotation IDs without racing concurrent annotation saves. */
export function removeAnnotationsById(
  dir: string,
  annotationIds: readonly string[],
): StoreResult<undefined> {
  return withStoreLock(dir, "annotations", () => {
    const loaded = loadAnnotationsUnlocked(dir);
    if (!loaded.ok) return loaded;
    const removed = new Set(annotationIds);
    return replaceAnnotationsUnlocked(
      dir,
      loaded.value.filter((annotation) => !removed.has(annotation.id)),
    );
  });
}

/** Merge annotations into the active list without duplicating existing annotation IDs. */
export function mergeAnnotations(
  dir: string,
  annotations: readonly Annotation[],
): StoreResult<number> {
  return withStoreLock(dir, "annotations", () => {
    const loaded = loadAnnotationsUnlocked(dir);
    if (!loaded.ok) return loaded;
    const existingIds = new Set(loaded.value.map((annotation) => annotation.id));
    const additions = annotations.filter((annotation) => !existingIds.has(annotation.id));
    if (additions.length === 0) return { ok: true, value: 0 };
    const replaced = replaceAnnotationsUnlocked(dir, [...loaded.value, ...additions]);
    if (!replaced.ok) return replaced;
    return { ok: true, value: additions.length };
  });
}

/** Present append-ordered archive sets with the most recently archived first. */
export function newestFirstArchivedSets(
  archives: readonly ArchivedAnnotationSet[],
): ArchivedAnnotationSet[] {
  return archives.slice().reverse();
}

/** Load complete, parsed annotation sets from the archive store. */
export function loadArchivedSets(dir: string): StoreResult<ArchivedAnnotationSet[]> {
  return withStoreLock(dir, "archives", () => loadArchivedSetsUnlocked(dir));
}

/** Atomically append one complete set to the archive store. */
export function appendArchivedSet(
  dir: string,
  archive: ArchivedAnnotationSet,
): StoreResult<undefined> {
  return withStoreLock(dir, "archives", () => {
    const loaded = loadArchivedSetsUnlocked(dir);
    if (!loaded.ok) return loaded;
    return replaceArchivedSetsUnlocked(dir, [...loaded.value, archive]);
  });
}

/** Permanently remove one archived set by its archive ID. */
export function removeArchivedSet(dir: string, archiveId: string): StoreResult<undefined> {
  return withStoreLock(dir, "archives", () => {
    const loaded = loadArchivedSetsUnlocked(dir);
    if (!loaded.ok) return loaded;
    return replaceArchivedSetsUnlocked(
      dir,
      loaded.value.filter((archive) => archive.id !== archiveId),
    );
  });
}

function loadAnnotationsUnlocked(dir: string): StoreResult<Annotation[]> {
  return loadJsonLines(annotationsPath(dir), "annotations", parseAnnotation);
}

function replaceAnnotationsUnlocked(
  dir: string,
  annotations: readonly Annotation[],
): StoreResult<undefined> {
  return replaceJsonLines(
    dir,
    annotationsPath(dir),
    "annotations",
    annotations,
    "Unable to update annotations",
  );
}

function loadArchivedSetsUnlocked(dir: string): StoreResult<ArchivedAnnotationSet[]> {
  return loadJsonLines(archivesPath(dir), "archives", parseArchivedAnnotationSet);
}

function replaceArchivedSetsUnlocked(
  dir: string,
  archives: readonly ArchivedAnnotationSet[],
): StoreResult<undefined> {
  return replaceJsonLines(dir, archivesPath(dir), "archives", archives, "Unable to update archives");
}

function loadJsonLines<T>(
  file: string,
  label: string,
  parse: (value: unknown) => T | undefined,
): StoreResult<T[]> {
  if (!fs.existsSync(file)) return { ok: true, value: [] };
  try {
    const records: T[] = [];
    for (const line of fs.readFileSync(file, "utf8").split("\n").filter(Boolean)) {
      let decoded: unknown;
      try {
        decoded = JSON.parse(line);
      } catch {
        return { ok: false, message: `Unable to read ${label} (invalid data)` };
      }
      const record = parse(decoded);
      if (!record) return { ok: false, message: `Unable to read ${label} (invalid data)` };
      records.push(record);
    }
    return { ok: true, value: records };
  } catch (error) {
    return { ok: false, message: safeFileError(`Unable to read ${label}`, error) };
  }
}

function replaceJsonLines(
  dir: string,
  file: string,
  temporaryLabel: string,
  records: readonly unknown[],
  errorMessage: string,
): StoreResult<undefined> {
  const temporary = path.join(dir, `.${temporaryLabel}-${process.pid}-${Date.now()}.tmp`);
  try {
    const contents = records.map((record) => JSON.stringify(record)).join("\n");
    fs.writeFileSync(temporary, contents ? `${contents}\n` : "", { mode: 0o600 });
    fs.renameSync(temporary, file);
    return { ok: true, value: undefined };
  } catch (error) {
    try {
      fs.rmSync(temporary, { force: true });
    } catch {}
    return { ok: false, message: safeFileError(errorMessage, error) };
  }
}

function withStoreLock<T>(
  dir: string,
  store: StoreName,
  operation: () => StoreResult<T>,
): StoreResult<T> {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (error) {
    return { ok: false, message: safeFileError(`Unable to access ${store}`, error) };
  }

  const acquired = acquireStoreLock(path.join(dir, `.${store}.lock`), store);
  if (!acquired.ok) return acquired;

  try {
    return operation();
  } finally {
    releaseStoreLock(acquired.value);
  }
}

function acquireStoreLock(lock: string, store: StoreName): StoreResult<StoreLockLease> {
  const owner = `${process.pid}:${randomUUID()}`;
  const created = createStoreLock(lock, store, owner);
  if (created._tag === "acquired") return { ok: true, value: { path: lock, owner } };
  if (created._tag === "error") return { ok: false, message: created.message };

  if (!isStaleLock(lock)) {
    return { ok: false, message: `${capitalized(store)} are busy; try again.` };
  }

  try {
    fs.rmSync(lock, { recursive: true, force: true });
  } catch (error) {
    return { ok: false, message: safeFileError(`Unable to lock ${store}`, error) };
  }

  const retried = createStoreLock(lock, store, owner);
  if (retried._tag === "exists") {
    return { ok: false, message: `${capitalized(store)} are busy; try again.` };
  }
  if (retried._tag === "error") return { ok: false, message: retried.message };
  return { ok: true, value: { path: lock, owner } };
}

function createStoreLock(lock: string, store: StoreName, owner: string): LockCreation {
  let directoryCreated = false;
  try {
    fs.mkdirSync(lock, { mode: 0o700 });
    directoryCreated = true;
    fs.writeFileSync(path.join(lock, "owner"), `${owner}\n`, { mode: 0o600 });
    return { _tag: "acquired" };
  } catch (error) {
    if (hasFileErrorCode(error, "EEXIST")) {
      return { _tag: "exists" };
    }
    if (directoryCreated) {
      try {
        fs.rmSync(lock, { recursive: true, force: true });
      } catch {}
    }
    return { _tag: "error", message: safeFileError(`Unable to lock ${store}`, error) };
  }
}

function isStaleLock(lock: string): boolean {
  try {
    return Date.now() - fs.statSync(lock).mtimeMs >= staleLockMilliseconds;
  } catch {
    return false;
  }
}

function releaseStoreLock(lease: StoreLockLease): void {
  try {
    const currentOwner = fs.readFileSync(path.join(lease.path, "owner"), "utf8").trim();
    if (currentOwner !== lease.owner) return;
    fs.rmSync(lease.path, { recursive: true, force: true });
  } catch {}
}

function capitalized(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function hasFileErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function safeFileError(prefix: string, error: unknown): string {
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return `${prefix} (${error.code})`;
  }
  return prefix;
}
