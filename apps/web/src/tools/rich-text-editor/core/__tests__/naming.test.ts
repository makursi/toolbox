import type { JSONContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";

import { exportFileName } from "@/tools/rich-text-editor/core/naming";

/**
 * The filename rule: the document names itself, and no field asks for a name.
 *
 * Dates are constructed from local fields on purpose, because the rule reads a
 * visitor's own calendar day; a UTC-based expectation would pass in Greenwich and
 * be wrong in Shanghai. The cap is tested on the long title rather than on a name
 * whose date happened to be short, so the number in the name is the rule's.
 */

const documentWithTitle = (title: string): JSONContent => ({
  content: [
    {
      attrs: { level: 1 },
      content: title === "" ? [] : [{ text: title, type: "text" }],
      type: "heading",
    },
    { type: "paragraph" },
  ],
  type: "doc",
});

const DATE = new Date(2026, 10, 27);

describe("the export filename rule", () => {
  it("is the sanitised title, the day and the format's extension", () => {
    expect(exportFileName(documentWithTitle("我的文档"), "markdown", DATE)).toBe(
      "我的文档-2026-11-27.md",
    );
    expect(exportFileName(documentWithTitle("我的文档"), "html", DATE)).toBe(
      "我的文档-2026-11-27.html",
    );
  });

  it("pads the date's month and day", () => {
    expect(exportFileName(documentWithTitle("标题"), "markdown", new Date(2026, 0, 5))).toBe(
      "标题-2026-01-05.md",
    );
  });

  it("falls back to 文档 when the title is empty", () => {
    expect(exportFileName(documentWithTitle(""), "markdown", DATE)).toBe("文档-2026-11-27.md");
    expect(exportFileName(documentWithTitle(""), "html", DATE)).toBe("文档-2026-11-27.html");
  });

  it("falls back when every character of the title is invalid in a filename", () => {
    expect(exportFileName(documentWithTitle('<>:"/\\|?*'), "markdown", DATE)).toBe(
      "文档-2026-11-27.md",
    );
  });

  it("takes the first heading as the title", () => {
    const document: JSONContent = {
      content: [
        { type: "paragraph" },
        { attrs: { level: 2 }, content: [{ text: "真正的标题", type: "text" }], type: "heading" },
      ],
      type: "doc",
    };

    expect(exportFileName(document, "markdown", DATE)).toBe("真正的标题-2026-11-27.md");
    expect(exportFileName({ type: "doc" }, "markdown", DATE)).toBe("文档-2026-11-27.md");
  });

  it("removes invalid characters, collapses whitespace and drops a trailing dot", () => {
    expect(exportFileName(documentWithTitle(" 季度 报告/2026. "), "markdown", DATE)).toBe(
      "季度 报告2026-2026-11-27.md",
    );
  });

  it("caps the title at 40 characters", () => {
    const long = "长".repeat(60);

    expect(exportFileName(documentWithTitle(long), "markdown", DATE)).toBe(
      `${"长".repeat(40)}-2026-11-27.md`,
    );
  });
});
