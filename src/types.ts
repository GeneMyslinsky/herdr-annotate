/** Herdr invocation fields retained as useful annotation provenance. */
export interface InvocationContext {
  workspace_id?: string;
  workspace_label?: string;
  tab_id?: string;
  tab_label?: string;
  focused_pane_id?: string;
  focused_pane_cwd?: string;
  focused_pane_agent?: string;
}

/** Clipboard text and provenance waiting for a user comment. */
export interface PendingAnnotation {
  selectedText: string;
  context: InvocationContext;
  capturedAt: string;
}

/** A saved annotation with a non-empty user comment. */
export interface Annotation extends PendingAnnotation {
  id: string;
  comment: string;
  createdAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

/** Parse untrusted Herdr context JSON into the small provenance shape this plugin stores. */
export function parseInvocationContext(value: unknown): InvocationContext {
  if (!isRecord(value)) return {};
  return {
    workspace_id: optionalString(value, "workspace_id"),
    workspace_label: optionalString(value, "workspace_label"),
    tab_id: optionalString(value, "tab_id"),
    tab_label: optionalString(value, "tab_label"),
    focused_pane_id: optionalString(value, "focused_pane_id"),
    focused_pane_cwd: optionalString(value, "focused_pane_cwd"),
    focused_pane_agent: optionalString(value, "focused_pane_agent"),
  };
}

/** Read a non-empty terminal selection from Herdr's plugin invocation context. */
export function selectedTextFromInvocation(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const selectedText = optionalString(value, "selected_text");
  return selectedText?.trim() ? selectedText : undefined;
}

/** Parse a pending-annotation file, returning undefined when required fields are invalid. */
export function parsePendingAnnotation(value: unknown): PendingAnnotation | undefined {
  if (!isRecord(value)) return undefined;
  const selectedText = optionalString(value, "selectedText");
  const capturedAt = optionalString(value, "capturedAt");
  if (selectedText === undefined || capturedAt === undefined) return undefined;
  return {
    selectedText,
    capturedAt,
    context: parseInvocationContext(value.context),
  };
}

/** Parse one persisted JSONL record, returning undefined for malformed records. */
export function parseAnnotation(value: unknown): Annotation | undefined {
  const pending = parsePendingAnnotation(value);
  if (!pending || !isRecord(value)) return undefined;
  const id = optionalString(value, "id");
  const comment = optionalString(value, "comment");
  const createdAt = optionalString(value, "createdAt");
  if (!id || !comment?.trim() || !createdAt) return undefined;
  return { ...pending, id, comment, createdAt };
}
