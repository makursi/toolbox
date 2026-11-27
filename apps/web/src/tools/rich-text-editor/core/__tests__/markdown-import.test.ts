import type { JSONContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";

import { EMPTY_DOCUMENT } from "@/tools/rich-text-editor/core/document";
import { documentFromMarkdown } from "@/tools/rich-text-editor/core/markdown-import";

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
    expect(documentFromMarkdown("| 表头 | 表头 |\n| --- | --- |\n| 单元 | 单元 |")).toEqual(
      documentOf(
        paragraph({ text: "| 表头 | 表头 | | --- | --- | | 单元 | 单元 |", type: "text" }),
      ),
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
