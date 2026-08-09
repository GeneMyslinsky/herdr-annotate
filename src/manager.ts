#!/usr/bin/env bun
import readline from "node:readline";
import { writeClipboard } from "./clipboard";
import { formatAnnotations, sanitizeTerminalText, wrapText } from "./format";
import { stateDir } from "./paths";
import { loadAnnotations, newestFirstAnnotations, replaceAnnotations } from "./store";
import type { Annotation } from "./types";

function requireStateDir(): string {
  const value = stateDir();
  if (!value) {
    console.error("HERDR_PLUGIN_STATE_DIR is not set");
    process.exit(1);
  }
  return value;
}

const dir = requireStateDir();
const out = (value: string) => process.stdout.write(value);
let annotations: Annotation[] = [];
let selected = 0;
let status = "";
let confirmClear = false;
let finished = false;

function reload(): boolean {
  const loaded = loadAnnotations(dir);
  if (!loaded.ok) {
    status = loaded.message;
    return false;
  }
  annotations = newestFirstAnnotations(loaded.value);
  selected = Math.max(0, Math.min(selected, annotations.length - 1));
  return true;
}

function clipped(text: string, width: number): string {
  const chars = Array.from(sanitizeTerminalText(text).replace(/\s+/g, " ").trim());
  if (chars.length <= width) return chars.join("");
  return `${chars.slice(0, Math.max(0, width - 1)).join("")}…`;
}

function writeAt(row: number, col: number, text: string): void {
  out(`\x1b[${row};${col}H${text}`);
}

function render(): void {
  const cols = Math.max(50, process.stdout.columns || 98);
  const rows = Math.max(14, process.stdout.rows || 28);
  const listWidth = Math.max(22, Math.min(36, Math.floor(cols * 0.36)));
  const detailLeft = listWidth + 3;
  const detailWidth = Math.max(1, cols - detailLeft - 1);
  const listRows = Math.max(1, rows - 4);
  const first = Math.max(0, Math.min(selected - Math.floor(listRows / 2), annotations.length - listRows));

  out("\x1b[2J\x1b[H\x1b[?25l");
  writeAt(
    1,
    2,
    `\x1b[1mAnnotations (${annotations.length})\x1b[0m  \x1b[2mnewest first\x1b[0m`,
  );
  for (let row = 2; row < rows; row += 1) writeAt(row, listWidth + 1, "\x1b[2m│\x1b[0m");

  if (annotations.length === 0) {
    writeAt(3, 2, "\x1b[2mNo annotations yet.\x1b[0m");
  } else {
    annotations.slice(first, first + listRows).forEach((annotation, index) => {
      const absolute = first + index;
      const active = absolute === selected;
      const label = clipped(annotation.selectedText, listWidth - 4);
      writeAt(2 + index, 2, `${active ? "\x1b[7m›" : " "} ${label}\x1b[0m`);
    });

    const current = annotations[selected];
    if (current) {
      const source = [current.context.workspace_label, current.context.tab_label]
        .filter(Boolean)
        .join(" / ");
      writeAt(2, detailLeft, "\x1b[1mSelected text\x1b[0m");
      const selectedLines = wrapText(sanitizeTerminalText(current.selectedText), detailWidth).slice(0, 7);
      selectedLines.forEach((line, index) => writeAt(3 + index, detailLeft, `\x1b[2m${line}\x1b[0m`));
      const commentRow = 4 + Math.max(3, selectedLines.length);
      writeAt(commentRow, detailLeft, "\x1b[1mComment\x1b[0m");
      wrapText(sanitizeTerminalText(current.comment), detailWidth)
        .slice(0, Math.max(1, rows - commentRow - 4))
        .forEach((line, index) => writeAt(commentRow + 1 + index, detailLeft, line));
      const metadata = [source, new Date(current.createdAt).toLocaleString()].filter(Boolean).join("  ·  ");
      if (metadata) writeAt(rows - 2, detailLeft, `\x1b[2m${clipped(metadata, detailWidth)}\x1b[0m`);
    }
  }

  const footer = confirmClear
    ? "Press Shift+D again to clear everything · Esc cancel"
    : status || "j/k move · y copy one · c copy all · d delete · Shift+D clear · q close";
  writeAt(rows, 2, `\x1b[2m${clipped(footer, cols - 3)}\x1b[0m`);
}

function copy(items: readonly Annotation[], label: string): void {
  if (items.length === 0) {
    status = "Nothing to copy.";
    return;
  }
  const copied = writeClipboard(formatAnnotations(items));
  status = copied.ok ? label : copied.message;
}

function deleteSelected(): void {
  const target = annotations[selected];
  if (!target) return;
  const latest = loadAnnotations(dir);
  if (!latest.ok) {
    status = latest.message;
    return;
  }
  const kept = latest.value.filter((annotation) => annotation.id !== target.id);
  const replaced = replaceAnnotations(dir, kept);
  if (!replaced.ok) {
    status = replaced.message;
    return;
  }
  status = "Annotation deleted.";
  reload();
}

function clearAll(): void {
  const replaced = replaceAnnotations(dir, []);
  if (!replaced.ok) {
    status = replaced.message;
    return;
  }
  status = "All annotations cleared.";
  confirmClear = false;
  reload();
}

function cleanup(): void {
  if (finished) return;
  finished = true;
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  out("\x1b[?25h\x1b[2J\x1b[H\x1b[?1049l");
}

function exit(code: number): void {
  cleanup();
  process.exit(code);
}

reload();
process.on("exit", cleanup);
process.on("SIGTERM", () => exit(0));
process.on("SIGHUP", () => exit(0));
process.stdout.on("resize", render);

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on("keypress", (text: string, key: readline.Key) => {
  if (key.ctrl && key.name === "c") return exit(0);
  if (key.name === "escape") {
    if (confirmClear) {
      confirmClear = false;
      status = "";
      render();
      return;
    }
    return exit(0);
  }
  if (key.name === "q") return exit(0);

  if (text === "D") {
    if (confirmClear) clearAll();
    else {
      confirmClear = true;
      status = "";
    }
  } else {
    confirmClear = false;
    status = "";
    if (key.name === "up" || key.name === "k") selected = Math.max(0, selected - 1);
    else if (key.name === "down" || key.name === "j") {
      selected = Math.min(Math.max(0, annotations.length - 1), selected + 1);
    } else if (key.name === "y") {
      const current = annotations[selected];
      copy(current ? [current] : [], "Annotation copied.");
    } else if (key.name === "c") copy(annotations, "All annotations copied.");
    else if (key.name === "d") deleteSelected();
    else if (key.name === "r") {
      reload();
      status = "Reloaded.";
    }
  }
  render();
});

out("\x1b[?1049h");
render();
