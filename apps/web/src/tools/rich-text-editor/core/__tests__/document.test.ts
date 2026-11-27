import type { JSONContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";

import {
  EMPTY_DOCUMENT,
  documentTitle,
  isEmptyDocument,
} from "@/tools/rich-text-editor/core/document";

/**
 * The document's title and its emptiness (#211).
 *
 * `isEmptyDocument` is the question the import confirmation asks before replacing
 * a draft, so the fixtures below are the cases a visitor's draft can be in: the
 * starting two empty blocks, a title with an empty body, whitespace, a rule, and
 * an empty heading that is not a title.
 */

const text = (value: string): JSONContent => ({ text: value, type: "text" });

const documentOf = (...content: JSONContent[]): JSONContent => ({ content, type: "doc" });

describe("isEmptyDocument", () => {
  it("treats the starting document as empty", () => {
    expect(isEmptyDocument(EMPTY_DOCUMENT)).toBe(true);
  });

  it("counts text in the title or the body as content", () => {
    expect(
      isEmptyDocument(
        documentOf({ attrs: { level: 1 }, content: [text("标题")], type: "heading" }),
      ),
    ).toBe(false);
    expect(isEmptyDocument(documentOf({ content: [text("正文")], type: "paragraph" }))).toBe(false);
  });

  it("does not count whitespace or an empty heading", () => {
    expect(
      isEmptyDocument(
        documentOf(
          { attrs: { level: 1 }, type: "heading" },
          { content: [text("   ")], type: "paragraph" },
        ),
      ),
    ).toBe(true);
  });

  it("counts a block the visitor placed, such as a rule", () => {
    expect(isEmptyDocument(documentOf({ type: "horizontalRule" }))).toBe(false);
  });

  it("looks inside containers", () => {
    expect(
      isEmptyDocument(
        documentOf({
          content: [
            { content: [{ content: [text("引用")], type: "paragraph" }], type: "blockquote" },
          ],
          type: "blockquote",
        }),
      ),
    ).toBe(false);
  });
});

describe("documentTitle", () => {
  it("is the first heading's words, and only the first one", () => {
    expect(
      documentTitle(
        documentOf(
          { content: [text("第一个")], type: "paragraph" },
          { attrs: { level: 2 }, content: [text("标题")], type: "heading" },
          { attrs: { level: 1 }, content: [text("不是它")], type: "heading" },
        ),
      ),
    ).toBe("标题");
  });

  it("is empty when there is no heading", () => {
    expect(documentTitle(documentOf({ content: [text("正文")], type: "paragraph" }))).toBe("");
  });
});
