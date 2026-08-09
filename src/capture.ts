#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { readClipboard } from "./clipboard";
import { notify, runHerdr } from "./herdr";
import { stateDir } from "./paths";
import {
  parseInvocationContext,
  selectedTextFromInvocation,
  type PendingAnnotation,
} from "./types";

try {
  let context = parseInvocationContext(undefined);
  let selectedText: string | undefined;
  try {
    const decoded: unknown = JSON.parse(process.env.HERDR_PLUGIN_CONTEXT_JSON ?? "{}");
    context = parseInvocationContext(decoded);
    selectedText = selectedTextFromInvocation(decoded);
  } catch {}

  if (!selectedText) {
    const clipboard = readClipboard();
    if (!clipboard.ok) throw new Error(clipboard.message);
    selectedText = clipboard.value;
  }
  if (!selectedText.trim()) {
    notify("Nothing to annotate", "Select text in Herdr or copy text to the clipboard.");
    process.exit(0);
  }

  const dir = stateDir();
  if (!dir) throw new Error("HERDR_PLUGIN_STATE_DIR is not set");
  fs.mkdirSync(dir, { recursive: true });

  const pending: PendingAnnotation = {
    selectedText,
    context,
    capturedAt: new Date().toISOString(),
  };
  const pendingPath = path.join(dir, `pending-${Date.now()}-${process.pid}.json`);
  fs.writeFileSync(pendingPath, `${JSON.stringify(pending)}\n`, { mode: 0o600 });

  const opened = runHerdr([
    "plugin",
    "pane",
    "open",
    "--plugin",
    "annotate",
    "--entrypoint",
    "editor",
    "--placement",
    "popup",
    "--width",
    "88",
    "--height",
    "24",
    "--env",
    `HERDR_ANNOTATE_PENDING=${pendingPath}`,
    "--focus",
  ]);
  if (!opened.ok) {
    fs.rmSync(pendingPath, { force: true });
    throw new Error(opened.message);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  notify("Annotate failed", message);
  console.error(message);
  process.exit(1);
}
