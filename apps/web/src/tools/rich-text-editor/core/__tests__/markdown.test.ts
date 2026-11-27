import type { JSONContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";

import { markdownFromDocument } from "@/tools/rich-text-editor/core/markdown";

/**
 * The Markdown writer, held in GFM's own terms.
 *
 * Every fixture is a JSON literal and every expectation is the Markdown a reader
 * of the file would see, written out here rather than produced by the writer's
 * helpers: a test that called the serializer to build its expectation would
 * agree with it whether or not it is right. Parsing the result back is the
 * import slice's subject (#211); this file holds what the bytes say.
 */

const text = (value: string, marks?: JSONContent["marks"]): JSONContent => ({
  text: value,
  type: "text",
  ...(marks === undefined ? {} : { marks }),
});

const paragraph = (...content: JSONContent[]): JSONContent => ({
  content,
  type: "paragraph",
});

const heading = (level: number, ...content: JSONContent[]): JSONContent => ({
  attrs: { level },
  content,
  type: "heading",
});

const documentOf = (...content: JSONContent[]): JSONContent => ({ content, type: "doc" });

/**
 * The source an image node carries: a `data:` URL, because the page has no upload
 * and the CSP draws nothing off this origin. It is short on purpose; the writer
 * copies the bytes rather than the picture, so their arithmetic is the only claim.
 */
const IMAGE_SRC = "data:image/png;base64,iVBORw0KGgo=";

const image = (attrs: Record<string, unknown> = {}): JSONContent => ({
  attrs: { alt: "", src: IMAGE_SRC, width: 100, ...attrs },
  type: "image",
});

const cell = (type: "tableCell" | "tableHeader", ...content: JSONContent[]): JSONContent => ({
  content,
  type,
});

const row = (...cells: JSONContent[]): JSONContent => ({ content: cells, type: "tableRow" });

const table = (...rows: JSONContent[]): JSONContent => ({ content: rows, type: "table" });

describe("the Markdown writer", () => {
  it("exports an empty document as an empty string", () => {
    expect(markdownFromDocument(documentOf(heading(1), paragraph()))).toBe("");
  });

  it("closes a non-empty document with one newline", () => {
    const markdown = markdownFromDocument(documentOf(heading(1, text("标题"))));

    expect(markdown).toBe("# 标题\n");
    expect(markdown.endsWith("\n")).toBe(true);
    expect(markdown.endsWith("\n\n")).toBe(false);
  });

  it("writes each heading at its level", () => {
    expect(
      markdownFromDocument(
        documentOf(heading(1, text("一级")), heading(2, text("二级")), heading(3, text("三级"))),
      ),
    ).toBe("# 一级\n\n## 二级\n\n### 三级\n");
  });

  it("writes the inline marks, with underline as the one inline HTML", () => {
    expect(
      markdownFromDocument(
        documentOf(
          paragraph(text("加粗", [{ type: "bold" }])),
          paragraph(text("斜体", [{ type: "italic" }])),
          paragraph(text("删除线", [{ type: "strike" }])),
          paragraph(text("行内代码", [{ type: "code" }])),
          paragraph(text("下划线", [{ type: "underline" }])),
          paragraph(text("强调", [{ type: "bold" }, { type: "italic" }])),
        ),
      ),
    ).toBe("**加粗**\n\n*斜体*\n\n~~删除线~~\n\n`行内代码`\n\n<u>下划线</u>\n\n***强调***\n");
  });

  it("writes a link with its address, and keeps a code span's backticks literal", () => {
    expect(
      markdownFromDocument(
        documentOf(
          paragraph(text("示例", [{ attrs: { href: "https://example.com" }, type: "link" }])),
          paragraph(
            text("带括号的链接", [{ attrs: { href: "https://example.com/a_(b)" }, type: "link" }]),
          ),
          paragraph(text("a `b` c", [{ type: "code" }])),
        ),
      ),
    ).toBe(
      "[示例](https://example.com)\n\n[带括号的链接](<https://example.com/a_(b)>)\n\n``a `b` c``\n",
    );
  });

  it("escapes the text a GFM reader would otherwise read as syntax", () => {
    expect(
      markdownFromDocument(
        documentOf(
          paragraph(text("*不是斜体* # 井号 [链接] \\ <b>")),
          paragraph(text("1. 不是编号")),
          paragraph(text("# 不是标题")),
          paragraph(text("- 不是列表")),
          paragraph(text("   # 缩进三个空格的标题")),
        ),
      ),
    ).toBe(
      "\\*不是斜体\\* # 井号 \\[链接\\] \\\\ \\<b\\>\n\n1\\. 不是编号\n\n\\# 不是标题\n\n\\- 不是列表\n\n   \\# 缩进三个空格的标题\n",
    );
  });

  it("writes nested bulleted and ordered lists at the item's content column", () => {
    expect(
      markdownFromDocument(
        documentOf({
          content: [
            {
              content: [paragraph(text("第一项"))],
              type: "listItem",
            },
            {
              content: [
                paragraph(text("第二项")),
                {
                  content: [
                    {
                      content: [
                        paragraph(text("子项一")),
                        {
                          attrs: { start: 1 },
                          content: [{ content: [paragraph(text("更深一层"))], type: "listItem" }],
                          type: "orderedList",
                        },
                      ],
                      type: "listItem",
                    },
                  ],
                  type: "bulletList",
                },
              ],
              type: "listItem",
            },
          ],
          type: "bulletList",
        }),
      ),
    ).toBe("- 第一项\n- 第二项\n  - 子项一\n    1. 更深一层\n");
  });

  it("starts an ordered list at its own number", () => {
    expect(
      markdownFromDocument(
        documentOf({
          attrs: { start: 3 },
          content: [
            { content: [paragraph(text("甲"))], type: "listItem" },
            { content: [paragraph(text("乙"))], type: "listItem" },
          ],
          type: "orderedList",
        }),
      ),
    ).toBe("3. 甲\n4. 乙\n");
  });

  it("writes task items with their checked state, nesting at the checkbox column", () => {
    expect(
      markdownFromDocument(
        documentOf({
          content: [
            { attrs: { checked: false }, content: [paragraph(text("未完成"))], type: "taskItem" },
            { attrs: { checked: true }, content: [paragraph(text("已完成"))], type: "taskItem" },
            {
              attrs: { checked: false },
              content: [
                paragraph(text("父项")),
                {
                  content: [
                    {
                      attrs: { checked: true },
                      content: [paragraph(text("子项"))],
                      type: "taskItem",
                    },
                  ],
                  type: "taskList",
                },
              ],
              type: "taskItem",
            },
          ],
          type: "taskList",
        }),
      ),
    ).toBe("- [ ] 未完成\n- [x] 已完成\n- [ ] 父项\n      - [x] 子项\n");
  });

  it("writes a blockquote, a language-carrying fenced block and a rule", () => {
    expect(
      markdownFromDocument(
        documentOf(
          {
            content: [paragraph(text("引用一句"))],
            type: "blockquote",
          },
          {
            attrs: { language: "ts" },
            content: [text("const answer = 42;")],
            type: "codeBlock",
          },
          { type: "horizontalRule" },
        ),
      ),
    ).toBe("> 引用一句\n\n```ts\nconst answer = 42;\n```\n\n---\n");
  });

  it("grows a code fence past a backtick run in the code", () => {
    expect(
      markdownFromDocument(
        documentOf({
          attrs: { language: null },
          content: [text("```\ninner\n```")],
          type: "codeBlock",
        }),
      ),
    ).toBe("````\n```\ninner\n```\n````\n");
  });

  it("keeps a hard break as a line break", () => {
    expect(
      markdownFromDocument(documentOf(paragraph(text("上"), { type: "hardBreak" }, text("下")))),
    ).toBe("上\\\n下\n");
  });

  it("skips a block that has nothing to say", () => {
    expect(
      markdownFromDocument(
        documentOf(
          heading(2),
          paragraph(),
          { content: [], type: "blockquote" },
          paragraph(text("只有这一段。")),
        ),
      ),
    ).toBe("只有这一段。\n");
  });

  it("writes an image as an inline GFM image carrying its alt and its bytes", () => {
    const markdown = markdownFromDocument(
      documentOf(paragraph(text("前文")), image({ alt: "照片" })),
    );

    expect(markdown).toBe(`前文\n\n![照片](${IMAGE_SRC})\n`);
    expect(markdown).toContain("![照片](data:image/png;base64,");
  });

  it("keeps an image's empty alt empty instead of inventing one", () => {
    expect(markdownFromDocument(documentOf(image()))).toBe(`![](${IMAGE_SRC})\n`);
  });

  it("escapes an alt text that would close the label early", () => {
    const markdown = markdownFromDocument(documentOf(image({ alt: "a]b *c*" })));

    expect(markdown).toBe(`![a\\]b \\*c\\*](${IMAGE_SRC})\n`);
  });

  it("drops the image's width, which is the one thing this format cannot carry", () => {
    const markdown = markdownFromDocument(documentOf(image({ alt: "照片", width: 50 })));

    expect(markdown).toBe(`![照片](${IMAGE_SRC})\n`);
    expect(markdown).not.toContain("width");
    expect(markdown).not.toContain("50%");
  });

  it("writes a table as a GFM pipe table with the first row as the header", () => {
    const markdown = markdownFromDocument(
      documentOf(
        table(
          row(
            cell("tableHeader", paragraph(text("名称"))),
            cell("tableHeader", paragraph(text("数量"))),
          ),
          row(cell("tableCell", paragraph(text("甲"))), cell("tableCell", paragraph(text("1")))),
          row(cell("tableCell", paragraph(text("乙"))), cell("tableCell", paragraph(text("2")))),
        ),
      ),
    );

    expect(markdown).toBe("| 名称 | 数量 |\n| --- | --- |\n| 甲 | 1 |\n| 乙 | 2 |\n");
  });

  it("escapes a pipe inside a cell so it cannot split the row", () => {
    expect(
      markdownFromDocument(
        documentOf(
          table(
            row(cell("tableHeader", paragraph(text("条件 | 结论")))),
            row(cell("tableCell", paragraph(text("a|b", [{ type: "code" }])))),
            row(cell("tableCell", paragraph(text("甲 | 乙")))),
          ),
        ),
      ),
    ).toBe("| 条件 \\| 结论 |\n| --- |\n| `a\\|b` |\n| 甲 \\| 乙 |\n");
  });

  it("keeps a cell's inline marks, and a hard break as the one inline form a row can hold", () => {
    expect(
      markdownFromDocument(
        documentOf(
          table(
            row(
              cell("tableHeader", paragraph(text("标记"))),
              cell("tableHeader", paragraph(text("换行"))),
            ),
            row(
              cell("tableCell", paragraph(text("加粗", [{ type: "bold" }]))),
              cell("tableCell", paragraph(text("上"), { type: "hardBreak" }, text("下"))),
            ),
          ),
        ),
      ),
    ).toBe("| 标记 | 换行 |\n| --- | --- |\n| **加粗** | 上<br>下 |\n");
  });

  it("writes an image inside a cell with its alt's pipe escaped for the row", () => {
    expect(
      markdownFromDocument(documentOf(table(row(cell("tableHeader", image({ alt: "a|b" })))))),
    ).toBe(`| ![a\\|b](${IMAGE_SRC}) |\n| --- |\n`);
  });

  it("repeats the header's column count on a row that is short, so the table stays a table", () => {
    expect(
      markdownFromDocument(
        documentOf(
          table(
            row(
              cell("tableHeader", paragraph(text("甲"))),
              cell("tableHeader", paragraph(text("乙"))),
            ),
            row(cell("tableCell", paragraph(text("只有一格")))),
          ),
        ),
      ),
    ).toBe("| 甲 | 乙 |\n| --- | --- |\n| 只有一格 |  |\n");
  });

  it("exports a document holding an image and a table in both of its blocks", () => {
    const markdown = markdownFromDocument(
      documentOf(
        heading(1, text("图文")),
        paragraph(text("正文")),
        image({ alt: "照片", width: 75 }),
        table(
          row(
            cell("tableHeader", paragraph(text("名称"))),
            cell("tableHeader", paragraph(text("数量"))),
          ),
          row(cell("tableCell", paragraph(text("甲"))), cell("tableCell", paragraph(text("1")))),
        ),
      ),
    );

    expect(markdown).toBe(
      `# 图文\n\n正文\n\n![照片](${IMAGE_SRC})\n\n| 名称 | 数量 |\n| --- | --- |\n| 甲 | 1 |\n`,
    );
  });
});
