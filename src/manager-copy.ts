import type { ClipboardResult } from "./clipboard";
import { formatAnnotations } from "./format";
import type { Annotation } from "./types";

type ClipboardWriter = (text: string) => ClipboardResult<undefined>;

/** Whether the annotation manager should close or remain visible after a copy attempt. */
export type ManagerCopyOutcome =
  | { readonly _tag: "close" }
  | { readonly _tag: "stay_open"; readonly message: string };

/** Format and copy annotations without changing the supplied annotations or their store. */
export function copyAnnotations(
  annotations: readonly Annotation[],
  writeClipboard: ClipboardWriter,
): ManagerCopyOutcome {
  if (annotations.length === 0) {
    return { _tag: "stay_open", message: "Nothing to copy." };
  }

  const copied = writeClipboard(formatAnnotations(annotations));
  if (!copied.ok) {
    return { _tag: "stay_open", message: copied.message };
  }

  return { _tag: "close" };
}
