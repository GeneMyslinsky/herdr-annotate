import path from "node:path";

/** Return Herdr's plugin-owned state directory when the runtime supplied one. */
export function stateDir(): string | undefined {
  return process.env.HERDR_PLUGIN_STATE_DIR || undefined;
}

/** Resolve the JSONL store inside an already parsed plugin state directory. */
export function annotationsPath(dir: string): string {
  return path.join(dir, "annotations.jsonl");
}

/** Resolve the archived-set JSONL store inside the plugin state directory. */
export function archivesPath(dir: string): string {
  return path.join(dir, "archives.jsonl");
}
