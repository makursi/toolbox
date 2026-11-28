import type { JSONContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";

import { MAX_IMAGE_BYTES } from "@/tools/rich-text-editor/core/admission";
import { EMPTY_DOCUMENT } from "@/tools/rich-text-editor/core/document";
import { markdownFromDocument } from "@/tools/rich-text-editor/core/markdown";
import {
  documentFromMarkdown,
  importMarkdown,
} from "@/tools/rich-text-editor/core/markdown-import";

/**
 * The Markdown reader, in the same terms as the writer it reverses.
 *
 * Every fixture is the Markdown text itself and every expectation is the document
 * a reader would see, written out rather than produced by the parser's helpers. A
 * second half of the contract is that no input throws: the last cases feed it
 * syntax it does not know and assert that the words survive as words.
 */

const paragraph = (...content: JSONContent[]): JSONContent => ({
  ...(content.length === 0 ? {} : { content }),
  type: "paragraph",
});

const listItem = (...content: JSONContent[]): JSONContent => ({ content, type: "listItem" });

const documentOf = (...content: JSONContent[]): JSONContent => ({ content, type: "doc" });

/** One cell of a table: a header cell or a body cell, holding one paragraph. */
const cellOf = (type: "tableCell" | "tableHeader", text: string): JSONContent => ({
  content: [text === "" ? paragraph() : paragraph({ text, type: "text" })],
  type,
});

/** A table node from its rows; the first row's cells are the header cells. */
const tableOf = (...rows: string[][]): JSONContent => ({
  content: rows.map((cells, row) => ({
    content: cells.map((cell) => cellOf(row === 0 ? "tableHeader" : "tableCell", cell)),
    type: "tableRow",
  })),
  type: "table",
});

/** A real 1×1 PNG as the data URL an imported file carries. */
const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** A data URL whose payload is `bytes` bytes behind a PNG signature. */
function dataUrlOf(bytes: number): string {
  const payload = Buffer.alloc(bytes);

  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].forEach((byte, index) => {
    payload[index] = byte;
  });

  return `data:image/png;base64,${payload.toString("base64")}`;
}

/** The text a node holds, joined without separators. */
function wordsOf(node: JSONContent): string {
  return typeof node.text === "string" ? node.text : (node.content ?? []).map(wordsOf).join("");
}

/** The text a document's blocks hold, joined, for the forgiving cases. */
function plainText(document: JSONContent): string {
  return (document.content ?? []).map(wordsOf).join("\n");
}

describe("the Markdown reader", () => {
  it("reads an empty file as the empty document", () => {
    expect(documentFromMarkdown("")).toEqual(EMPTY_DOCUMENT);
    expect(documentFromMarkdown("  \n\n\t\n")).toEqual(EMPTY_DOCUMENT);
  });

  it("reads the three exported heading levels, with a closing hash run dropped", () => {
    expect(documentFromMarkdown("# 一级\n\n## 二级 ##\n\n### 三级")).toEqual(
      documentOf(
        { attrs: { level: 1 }, content: [{ text: "一级", type: "text" }], type: "heading" },
        { attrs: { level: 2 }, content: [{ text: "二级", type: "text" }], type: "heading" },
        { attrs: { level: 3 }, content: [{ text: "三级", type: "text" }], type: "heading" },
      ),
    );
  });

  it("reads the inline marks the writer writes", () => {
    expect(
      documentFromMarkdown(
        "一段**加粗**、*斜体*、~~删除线~~、`代码`与[链接](https://example.com/docs)。",
      ),
    ).toEqual(
      documentOf(
        paragraph(
          { text: "一段", type: "text" },
          { marks: [{ type: "bold" }], text: "加粗", type: "text" },
          { text: "、", type: "text" },
          { marks: [{ type: "italic" }], text: "斜体", type: "text" },
          { text: "、", type: "text" },
          { marks: [{ type: "strike" }], text: "删除线", type: "text" },
          { text: "、", type: "text" },
          { marks: [{ type: "code" }], text: "代码", type: "text" },
          { text: "与", type: "text" },
          {
            marks: [{ attrs: { href: "https://example.com/docs" }, type: "link" }],
            text: "链接",
            type: "text",
          },
          { text: "。", type: "text" },
        ),
      ),
    );
  });

  it("reads the underline the export writes as inline HTML, inside a bold span", () => {
    expect(documentFromMarkdown("**<u>下划线</u>**")).toEqual(
      documentOf(
        paragraph({
          marks: [{ type: "underline" }, { type: "bold" }],
          text: "下划线",
          type: "text",
        }),
      ),
    );
  });

  /**
   * 高亮 is the second inline-HTML construct (#230), read in the same
   * angle-bracket branch as underline, `<br>` and an autolink. The export writes
   * it inside the delimitable marks, so the reader has to find it inside a bold
   * span — and the whole document has to come back from the writer's own bytes.
   */
  it("reads the highlight the export writes as inline HTML, inside a bold span", () => {
    expect(documentFromMarkdown("**<mark>高亮</mark>**")).toEqual(
      documentOf(
        paragraph({
          marks: [{ type: "highlight" }, { type: "bold" }],
          text: "高亮",
          type: "text",
        }),
      ),
    );
  });

  it("imports a highlighted document back from the writer's own Markdown", () => {
    const document = documentOf(
      { attrs: { level: 1 }, content: [{ text: "高亮标题", type: "text" }], type: "heading" },
      paragraph(
        { text: "前面", type: "text" },
        { marks: [{ type: "highlight" }], text: "高亮", type: "text" },
        { text: "后面", type: "text" },
      ),
    );

    expect(importMarkdown(markdownFromDocument(document))).toEqual({
      document,
      refusals: [],
    });
  });

  /**
   * Alignment is Markdown's documented degradation (#230): the words and the
   * block survive, the layout does not. This is not a defect in the reader — the
   * writer never emits it — but the pair is asserted so an "alignment parsed from
   * Markdown" cannot appear without someone deciding it should.
   */
  it("drops an alignment, which Markdown has no form for", () => {
    const document = documentOf(
      {
        attrs: { textAlign: "center" },
        content: [{ text: "居中", type: "text" }],
        type: "paragraph",
      },
      {
        attrs: { level: 2, textAlign: "right" },
        content: [{ text: "右", type: "text" }],
        type: "heading",
      },
    );

    expect(importMarkdown(markdownFromDocument(document)).document).toEqual(
      documentOf(paragraph({ text: "居中", type: "text" }), {
        attrs: { level: 2 },
        content: [{ text: "右", type: "text" }],
        type: "heading",
      }),
    );
  });

  it("reads emphasis nested inside emphasis and inside code spans", () => {
    expect(documentFromMarkdown("**加粗与*斜体*，还有 `a**b`**")).toEqual(
      documentOf(
        paragraph(
          { marks: [{ type: "bold" }], text: "加粗与", type: "text" },
          {
            marks: [{ type: "italic" }, { type: "bold" }],
            text: "斜体",
            type: "text",
          },
          { marks: [{ type: "bold" }], text: "，还有 ", type: "text" },
          { marks: [{ type: "code" }, { type: "bold" }], text: "a**b", type: "text" },
        ),
      ),
    );
  });

  it("reads nested bulleted and ordered lists", () => {
    expect(
      documentFromMarkdown(
        "- 第一项\n  - 嵌套项\n- 第二项\n\n1. 编号一\n   1. 嵌套编号\n2. 编号二",
      ),
    ).toEqual(
      documentOf(
        {
          content: [
            listItem(paragraph({ text: "第一项", type: "text" }), {
              content: [listItem(paragraph({ text: "嵌套项", type: "text" }))],
              type: "bulletList",
            }),
            listItem(paragraph({ text: "第二项", type: "text" })),
          ],
          type: "bulletList",
        },
        {
          attrs: { start: 1 },
          content: [
            listItem(paragraph({ text: "编号一", type: "text" }), {
              attrs: { start: 1 },
              content: [listItem(paragraph({ text: "嵌套编号", type: "text" }))],
              type: "orderedList",
            }),
            listItem(paragraph({ text: "编号二", type: "text" })),
          ],
          type: "orderedList",
        },
      ),
    );
  });

  it("keeps an ordered list's starting number", () => {
    expect(documentFromMarkdown("3. 三\n4. 四")).toEqual(
      documentOf({
        attrs: { start: 3 },
        content: [
          listItem(paragraph({ text: "三", type: "text" })),
          listItem(paragraph({ text: "四", type: "text" })),
        ],
        type: "orderedList",
      }),
    );
  });

  it("reads checked and unchecked task items", () => {
    expect(documentFromMarkdown("- [x] 已完成\n- [ ] 未完成")).toEqual(
      documentOf({
        content: [
          {
            attrs: { checked: true },
            content: [paragraph({ text: "已完成", type: "text" })],
            type: "taskItem",
          },
          {
            attrs: { checked: false },
            content: [paragraph({ text: "未完成", type: "text" })],
            type: "taskItem",
          },
        ],
        type: "taskList",
      }),
    );
  });

  it("reads a nested task item the way the writer indents it", () => {
    expect(documentFromMarkdown("- [ ] 父项\n      - [x] 子项")).toEqual(
      documentOf({
        content: [
          {
            attrs: { checked: false },
            content: [
              paragraph({ text: "父项", type: "text" }),
              {
                content: [
                  {
                    attrs: { checked: true },
                    content: [paragraph({ text: "子项", type: "text" })],
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
    );
  });

  it("reads a quote, a fenced code block with its language, and a rule", () => {
    expect(
      documentFromMarkdown(
        "> 引用一句。\n> 引用第二句。\n\n```ts\nconst answer = 42;\n```\n\n---\n",
      ),
    ).toEqual(
      documentOf(
        {
          content: [paragraph({ text: "引用一句。 引用第二句。", type: "text" })],
          type: "blockquote",
        },
        {
          attrs: { language: "ts" },
          content: [{ text: "const answer = 42;", type: "text" }],
          type: "codeBlock",
        },
        { type: "horizontalRule" },
      ),
    );
  });

  it("keeps backticks inside a fenced block literal", () => {
    expect(documentFromMarkdown("```js\nconst a = `x`;\n```")).toEqual(
      documentOf({
        attrs: { language: "js" },
        content: [{ text: "const a = `x`;", type: "text" }],
        type: "codeBlock",
      }),
    );
  });

  it("reads a soft break as a space and a hard break as a break", () => {
    expect(documentFromMarkdown("第一行\n第二行")).toEqual(
      documentOf(paragraph({ text: "第一行 第二行", type: "text" })),
    );

    expect(documentFromMarkdown("第一行  \n第二行")).toEqual(
      documentOf(
        paragraph(
          { text: "第一行", type: "text" },
          { type: "hardBreak" },
          { text: "第二行", type: "text" },
        ),
      ),
    );
  });

  it("reads a leading block marker as a paragraph once it is escaped", () => {
    expect(documentFromMarkdown("\\# 不是标题\n\\- 不是列表\n1\\. 不是编号")).toEqual(
      documentOf(paragraph({ text: "# 不是标题 - 不是列表 1. 不是编号", type: "text" })),
    );
  });

  it("keeps what it does not know as text", () => {
    // A reference-style link is syntax this reader has no construct for, so the
    // whole line is the text it was written as.
    expect(plainText(documentFromMarkdown("[引用式链接][ref]\n\n[ref]: https://example.com"))).toBe(
      "[引用式链接][ref]\n[ref]: https://example.com",
    );

    // The unmatched constructs are literal, not a refusal and not a crash.
    expect(plainText(documentFromMarkdown("C:\\path 和 \\*字面星号\\* 与 [未闭合 **未闭合"))).toBe(
      "C:\\path 和 *字面星号* 与 [未闭合 **未闭合",
    );
  });

  it("does not throw on anything, including an unclosed fence", () => {
    expect(() => documentFromMarkdown("```\n未闭合的围栏")).not.toThrow();
    expect(() => documentFromMarkdown("<>>>***___~~~[[[(((")).not.toThrow();
    expect(() => documentFromMarkdown("\u0000\uFEFF\r\n\r###")).not.toThrow();
  });
});

/**
 * GFM pipe tables (#220).
 *
 * The text is the format the writer emits, read the other way: a header row, the
 * delimiter row under it, then one row per line. Alignment markers are dropped
 * because the document has no column alignment to carry them in, and a row that is
 * the wrong width is padded or cut to the header's, which is what GFM itself says a
 * reader does with one.
 */
describe("the Markdown reader's tables", () => {
  it("reads a header row and its body rows, with the delimiter row dropped", () => {
    expect(documentFromMarkdown("| 项目 | 数量 |\n| --- | ---: |\n| 甲 | 1 |\n| 乙 | 2 |")).toEqual(
      documentOf(tableOf(["项目", "数量"], ["甲", "1"], ["乙", "2"])),
    );
  });

  it("reads a table in the middle of prose as its own block", () => {
    expect(
      documentFromMarkdown("上面一段。\n| 项目 | 数量 |\n| --- | --- |\n| 甲 | 1 |\n下面一段。"),
    ).toEqual(
      documentOf(
        paragraph({ text: "上面一段。", type: "text" }),
        tableOf(["项目", "数量"], ["甲", "1"]),
        paragraph({ text: "下面一段。", type: "text" }),
      ),
    );
  });

  it("pads a short row and drops the cells past the header's width", () => {
    expect(
      documentFromMarkdown("| 甲 | 乙 | 丙 |\n| --- | --- | --- |\n| 1 |\n| 2 | 3 | 4 | 5 |"),
    ).toEqual(documentOf(tableOf(["甲", "乙", "丙"], ["1", "", ""], ["2", "3", "4"])));
  });

  it("reads a cell's inline marks and its escaped pipe", () => {
    expect(documentFromMarkdown("| **加粗** | a \\| b |\n| --- | --- |\n| `x` | 链接 |")).toEqual(
      documentOf({
        content: [
          {
            content: [
              {
                content: [paragraph({ marks: [{ type: "bold" }], text: "加粗", type: "text" })],
                type: "tableHeader",
              },
              { content: [paragraph({ text: "a | b", type: "text" })], type: "tableHeader" },
            ],
            type: "tableRow",
          },
          {
            content: [
              {
                content: [paragraph({ marks: [{ type: "code" }], text: "x", type: "text" })],
                type: "tableCell",
              },
              { content: [paragraph({ text: "链接", type: "text" })], type: "tableCell" },
            ],
            type: "tableRow",
          },
        ],
        type: "table",
      }),
    );
  });

  it("needs a delimiter row: pipes alone stay a paragraph", () => {
    expect(documentFromMarkdown("| 只是 | 一段文字 |")).toEqual(
      documentOf(paragraph({ text: "| 只是 | 一段文字 |", type: "text" })),
    );
  });

  it("keeps a row's escaped pipe at its end as a cell, not as the row's edge", () => {
    expect(documentFromMarkdown("| 甲 | 乙 |\n| --- | --- |\n| a \\|")).toEqual(
      documentOf(tableOf(["甲", "乙"], ["a |", ""])),
    );
  });
});

/**
 * Images (#220).
 *
 * An image is a block node of this document, while GFM writes it inline, so a data
 * image becomes a block of its own and the words around it keep theirs. A source
 * the document cannot draw — a remote URL, or a data URL that is not base64 — is not
 * an image at all here: its alt text is the text that remains, which is the same
 * answer an over-limit image gets from admission.
 */
describe("the Markdown reader's images", () => {
  it("reads a data image as an image block", () => {
    expect(documentFromMarkdown(`![照片](${PNG_DATA_URL})`)).toEqual(
      documentOf({ attrs: { alt: "照片", src: PNG_DATA_URL }, type: "image" }),
    );
  });

  it("lifts an image out of the words around it, in the order they were written", () => {
    expect(documentFromMarkdown(`前文\n\n![照片](${PNG_DATA_URL})\n\n后文`)).toEqual(
      documentOf(
        paragraph({ text: "前文", type: "text" }),
        { attrs: { alt: "照片", src: PNG_DATA_URL }, type: "image" },
        paragraph({ text: "后文", type: "text" }),
      ),
    );
  });

  it("keeps a remote image's alt text as text, and no image", () => {
    expect(documentFromMarkdown("![远程照片](https://example.com/photo.png)")).toEqual(
      documentOf(paragraph({ text: "远程照片", type: "text" })),
    );
    // Inside a sentence the alt stays where the image was.
    expect(documentFromMarkdown("前文 ![远程照片](https://example.com/x.png) 后文")).toEqual(
      documentOf(paragraph({ text: "前文 远程照片 后文", type: "text" })),
    );
  });

  it("drops an image whose data URL cannot be measured to its alt text", () => {
    // A `data:` URL that is not base64 is not a file this Tool can ask the limits
    // about; the alt text is what remains.
    expect(documentFromMarkdown("![图](data:image/png,not-base64)")).toEqual(
      documentOf(paragraph({ text: "图", type: "text" })),
    );
  });

  it("refuses an image over the per-file limit and keeps its alt text", () => {
    const imported = importMarkdown(`![超大图](${dataUrlOf(MAX_IMAGE_BYTES + 1)})`);

    expect(imported.document).toEqual(documentOf(paragraph({ text: "超大图", type: "text" })));
    expect(imported.refusals).toEqual(["size"]);
  });

  it("refuses the eleventh image and keeps its alt text, so the document holds ten", () => {
    const lines = Array.from({ length: 11 }, (_, index) => `![第${index + 1}张](${PNG_DATA_URL})`);
    const imported = importMarkdown(lines.join("\n\n"));
    const content = imported.document.content ?? [];

    expect(imported.refusals).toEqual(["count"]);
    expect(content.filter((node) => node.type === "image")).toHaveLength(10);
    expect(content[content.length - 1]).toEqual(paragraph({ text: "第11张", type: "text" }));
  });

  it("imports a document with an image and a table back from the writer's own Markdown", () => {
    const document = documentOf(
      { attrs: { level: 1 }, content: [{ text: "图文导出", type: "text" }], type: "heading" },
      { attrs: { alt: "照片", src: PNG_DATA_URL }, type: "image" },
      tableOf(["项目", "数量"], ["甲", "1"], ["乙", "2"]),
    );

    expect(importMarkdown(markdownFromDocument(document))).toEqual({
      document,
      refusals: [],
    });
  });

  it("loses an image's width and nothing else, which is Markdown's one degradation", () => {
    const document = documentOf({
      attrs: { alt: "照片", src: PNG_DATA_URL, width: 50 },
      type: "image",
    });
    const imported = importMarkdown(markdownFromDocument(document));

    // GFM has no width syntax, so the file cannot carry it; the node takes its own
    // default when the editor reads it.
    expect(imported.document).toEqual(
      documentOf({ attrs: { alt: "照片", src: PNG_DATA_URL }, type: "image" }),
    );
  });
});
