import type { JSONContent } from "@tiptap/react";

/**
 * The shape of the one record the draft store holds.
 *
 * A draft is three facts and nothing else: which schema wrote it, the document
 * itself as ProseMirror JSON, and when it was written. The version is the record's
 * own, not the IndexedDB database's: it is what a later build reads before it
 * trusts a document it did not write, and it can move without the store moving.
 *
 * The document stays ProseMirror JSON (`apps/web/src/tools/rich-text-editor/rules.md`).
 * Nothing here derives Markdown or HTML: those are export formats and later
 * tickets. A record that is not this shape, or not this version, is ignored rather
 * than repaired, because a malformed draft is not a document a visitor should be
 * handed.
 */
export const DRAFT_SCHEMA_VERSION = 1;

export interface StoredDraft {
  /** The schema that wrote the document; read before the document is trusted. */
  readonly version: number;
  /** The canonical document, exactly as the editor produced it. */
  readonly document: JSONContent;
  /** When the write happened, in milliseconds since the epoch. */
  readonly savedAt: number;
}

/**
 * Whether a value read from the store is a draft this build can open.
 *
 * The check is deliberately narrow: a `doc` with a content array is the one shape
 * the editor starts from, and anything else is a value from an older or broken
 * writer. `savedAt` is not used for ordering, but a record without one is not a
 * record this module wrote, so it is refused with the rest.
 */
export function isStoredDraft(value: unknown): value is StoredDraft {
  if (typeof value !== "object" || value === null) return false;

  const record = value as Partial<Record<keyof StoredDraft, unknown>>;

  return (
    record.version === DRAFT_SCHEMA_VERSION &&
    typeof record.savedAt === "number" &&
    isDocument(record.document)
  );
}

function isDocument(value: unknown): value is JSONContent {
  if (typeof value !== "object" || value === null) return false;

  const document = value as { type?: unknown; content?: unknown };

  return document.type === "doc" && Array.isArray(document.content);
}
