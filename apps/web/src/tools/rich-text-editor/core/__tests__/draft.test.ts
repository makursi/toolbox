import { describe, expect, it } from "vitest";

import {
  DRAFT_SCHEMA_VERSION,
  isStoredDraft,
  type StoredDraft,
} from "@/tools/rich-text-editor/core/draft";

/**
 * The one record's shape.
 *
 * The guard is what stands between a value in IndexedDB and the editor: a record
 * from another schema, or a half-written value, has to read as "no draft" rather
 * than as a document to open. The fixtures are JSON literals, not a DOM or a store.
 */
const DRAFT: StoredDraft = {
  document: {
    content: [
      {
        attrs: { level: 1 },
        content: [{ text: "标题", type: "text" }],
        type: "heading",
      },
      { type: "paragraph" },
    ],
    type: "doc",
  },
  savedAt: 1_760_000_000_000,
  version: DRAFT_SCHEMA_VERSION,
};

describe("a stored draft", () => {
  it("accepts the record this build writes", () => {
    expect(isStoredDraft(DRAFT)).toBe(true);
  });

  it("refuses a record from a different schema", () => {
    expect(isStoredDraft({ ...DRAFT, version: DRAFT_SCHEMA_VERSION + 1 })).toBe(false);
  });

  it("refuses a value that is not a ProseMirror document", () => {
    expect(isStoredDraft({ ...DRAFT, document: { type: "paragraph" } })).toBe(false);
    expect(isStoredDraft({ ...DRAFT, document: { content: [], type: "text" } })).toBe(false);
    expect(isStoredDraft({ ...DRAFT, document: "doc" })).toBe(false);
  });

  it("refuses a record without a timestamp or with a non-numeric one", () => {
    const { savedAt: _savedAt, ...withoutTimestamp } = DRAFT;

    expect(isStoredDraft(withoutTimestamp)).toBe(false);
    expect(isStoredDraft({ ...DRAFT, savedAt: "today" })).toBe(false);
  });

  it("refuses values that are not records at all", () => {
    for (const value of [null, undefined, 0, "", [], true]) {
      expect(isStoredDraft(value), String(value)).toBe(false);
    }
  });
});
