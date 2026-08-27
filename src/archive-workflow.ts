import type { ClipboardResult } from "./clipboard";
import { formatAnnotations } from "./format";
import { newestFirstAnnotations, type StoreResult } from "./store";
import type { Annotation, ArchivedAnnotationSet } from "./types";

type ClipboardWriter = (text: string) => ClipboardResult<undefined>;

interface CopyAndArchiveDependencies {
  readonly loadActive: () => StoreResult<Annotation[]>;
  readonly writeClipboard: ClipboardWriter;
  readonly saveArchive: (archive: ArchivedAnnotationSet) => StoreResult<undefined>;
  readonly removeActive: (annotationIds: readonly string[]) => StoreResult<undefined>;
  readonly createArchiveId: () => string;
  readonly now: () => string;
}

interface RestoreArchiveDependencies {
  readonly mergeActive: (annotations: readonly Annotation[]) => StoreResult<number>;
  readonly removeArchive: (archiveId: string) => StoreResult<undefined>;
}

/** The manager transition produced by a copy-and-archive attempt. */
export type CopyAndArchiveOutcome =
  | { readonly _tag: "close"; readonly archivedCount: number }
  | { readonly _tag: "stay_open"; readonly message: string }
  | { readonly _tag: "archived_active_retained"; readonly message: string };

/** Copy the active annotations, persist a recoverable archive, then remove those active IDs. */
export function copyAndArchiveAnnotations(
  dependencies: CopyAndArchiveDependencies,
): CopyAndArchiveOutcome {
  const loaded = dependencies.loadActive();
  if (!loaded.ok) return { _tag: "stay_open", message: loaded.message };
  if (loaded.value.length === 0) {
    return { _tag: "stay_open", message: "Nothing to copy and archive." };
  }

  const copied = dependencies.writeClipboard(
    formatAnnotations(newestFirstAnnotations(loaded.value)),
  );
  if (!copied.ok) return { _tag: "stay_open", message: copied.message };

  const archive: ArchivedAnnotationSet = {
    version: 1,
    id: dependencies.createArchiveId(),
    archivedAt: dependencies.now(),
    annotations: loaded.value,
  };
  const saved = dependencies.saveArchive(archive);
  if (!saved.ok) return { _tag: "stay_open", message: saved.message };

  const removed = dependencies.removeActive(loaded.value.map((annotation) => annotation.id));
  if (!removed.ok) {
    return { _tag: "archived_active_retained", message: removed.message };
  }

  return { _tag: "close", archivedCount: loaded.value.length };
}

/** The manager transition produced by restoring one archived annotation set. */
export type RestoreArchivedSetOutcome =
  | { readonly _tag: "restored"; readonly restoredCount: number }
  | { readonly _tag: "stay_open"; readonly message: string }
  | {
      readonly _tag: "restored_archive_retained";
      readonly restoredCount: number;
      readonly message: string;
    };

/** Merge an archived set into active annotations, then remove its recoverable archive record. */
export function restoreArchivedSet(
  archive: ArchivedAnnotationSet,
  dependencies: RestoreArchiveDependencies,
): RestoreArchivedSetOutcome {
  const merged = dependencies.mergeActive(archive.annotations);
  if (!merged.ok) return { _tag: "stay_open", message: merged.message };

  const removed = dependencies.removeArchive(archive.id);
  if (!removed.ok) {
    return {
      _tag: "restored_archive_retained",
      restoredCount: merged.value,
      message: removed.message,
    };
  }

  return { _tag: "restored", restoredCount: merged.value };
}
