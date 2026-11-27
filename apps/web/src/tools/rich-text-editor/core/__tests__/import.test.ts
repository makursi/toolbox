import { describe, expect, it } from "vitest";

import { importFormatOf } from "@/tools/rich-text-editor/core/import";

/**
 * Which parser a chosen file gets (#211).
 *
 * The name decides first, because the visitor picked a file with an extension and
 * the Tool should trust it. The content is only a tie-breaker for a name that
 * says nothing, and a bare text file then falls back to Markdown: the format this
 * Tool writes, and the one whose parser is forgiving.
 */

describe("importFormatOf", () => {
  it("reads the two Markdown extensions", () => {
    expect(importFormatOf("notes.md")).toBe("markdown");
    expect(importFormatOf("NOTES.MARKDOWN")).toBe("markdown");
  });

  it("reads the two HTML extensions", () => {
    expect(importFormatOf("page.html")).toBe("html");
    expect(importFormatOf("page.HTM")).toBe("html");
  });

  it("trusts the extension over the content", () => {
    expect(importFormatOf("notes.md", "<p>这是一段 HTML 形状的文字</p>")).toBe("markdown");
    expect(importFormatOf("page.html", "# 这是一个标题")).toBe("html");
  });

  it("sniffs content when the name has no extension", () => {
    expect(importFormatOf("no-extension", "<!doctype html><p>正文</p>")).toBe("html");
    expect(importFormatOf("no-extension", "<div>正文</div>")).toBe("html");
  });

  it("falls back to Markdown", () => {
    expect(importFormatOf("no-extension", "# 标题\n\n正文")).toBe("markdown");
    expect(importFormatOf("no-extension")).toBe("markdown");
  });
});
