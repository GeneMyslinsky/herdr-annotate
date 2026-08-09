import fs from "node:fs";
import path from "node:path";
import { annotationsPath } from "./paths";
import { parseAnnotation, type Annotation } from "./types";

/** The result of an expected annotation-store operation. */
export type StoreResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

/** Present append-ordered annotations with the most recently saved first. */
export function newestFirstAnnotations(annotations: readonly Annotation[]): Annotation[] {
  return annotations.slice().reverse();
}

/** Load every valid annotation from the plugin's JSONL store. */
export function loadAnnotations(dir: string): StoreResult<Annotation[]> {
  const file = annotationsPath(dir);
  if (!fs.existsSync(file)) return { ok: true, value: [] };
  try {
    const annotations = fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        try {
          const decoded: unknown = JSON.parse(line);
          const annotation = parseAnnotation(decoded);
          return annotation ? [annotation] : [];
        } catch {
          return [];
        }
      });
    return { ok: true, value: annotations };
  } catch (error) {
    return { ok: false, message: safeFileError("Unable to read annotations", error) };
  }
}

/** Append one annotation without rewriting existing records. */
export function appendAnnotation(dir: string, annotation: Annotation): StoreResult<undefined> {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(annotationsPath(dir), `${JSON.stringify(annotation)}\n`, { mode: 0o600 });
    return { ok: true, value: undefined };
  } catch (error) {
    return { ok: false, message: safeFileError("Unable to save annotation", error) };
  }
}

/** Atomically replace the store with the supplied records. */
export function replaceAnnotations(
  dir: string,
  annotations: readonly Annotation[],
): StoreResult<undefined> {
  const file = annotationsPath(dir);
  const temporary = path.join(dir, `.annotations-${process.pid}-${Date.now()}.tmp`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const contents = annotations.map((annotation) => JSON.stringify(annotation)).join("\n");
    fs.writeFileSync(temporary, contents ? `${contents}\n` : "", { mode: 0o600 });
    fs.renameSync(temporary, file);
    return { ok: true, value: undefined };
  } catch (error) {
    try {
      fs.rmSync(temporary, { force: true });
    } catch {}
    return { ok: false, message: safeFileError("Unable to update annotations", error) };
  }
}

function safeFileError(prefix: string, error: unknown): string {
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return `${prefix} (${error.code})`;
  }
  return prefix;
}
