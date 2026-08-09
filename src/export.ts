#!/usr/bin/env bun
import { writeClipboard } from "./clipboard";
import { formatAnnotations } from "./format";
import { notify } from "./herdr";
import { loadAnnotations, newestFirstAnnotations } from "./store";

try {
  const dir = process.env.HERDR_PLUGIN_STATE_DIR;
  if (!dir) throw new Error("HERDR_PLUGIN_STATE_DIR is not set");
  const loaded = loadAnnotations(dir);
  if (!loaded.ok) throw new Error(loaded.message);
  const annotations = newestFirstAnnotations(loaded.value);

  if (annotations.length === 0) {
    notify("No annotations", "There is nothing to copy yet.");
    process.exit(0);
  }

  const copied = writeClipboard(formatAnnotations(annotations));
  if (!copied.ok) throw new Error(copied.message);
  notify(
    "Annotations copied",
    `${annotations.length} annotation${annotations.length === 1 ? "" : "s"} copied as Markdown.`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  notify("Copy failed", message);
  console.error(message);
  process.exit(1);
}
