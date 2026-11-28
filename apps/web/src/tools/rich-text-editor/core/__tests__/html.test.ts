import type { JSONContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";

import { htmlFromDocument } from "@/tools/rich-text-editor/core/html";

/**
 * The standalone-HTML writer, held in HTML's own terms: the doctype, the charset,
 * the title, the embedded stylesheet, the elements each block and mark becomes,
 * and the escaping a browser needs. The bytes are checked as text; whether a
 * browser paints them is the gate's question, not this file's.
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

/** The source an image node carries: a `data:` URL, for the reason the page has none. */
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

describe("the standalone HTML writer", () => {
  it("writes a complete document that carries everything it needs", () => {
    const html = htmlFromDocument(documentOf(heading(1, text("标题")), paragraph(text("正文"))));

    expect(html.startsWith('<!doctype html>\n<html lang="zh-CN">\n<head>')).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain("<title>标题</title>");
    expect(html).toContain("<style>");
    expect(html).toContain("</style>");
    expect(html).toContain("<body>\n<article>\n<h1>标题</h1>\n<p>正文</p>\n</article>\n</body>");
    expect(html.endsWith("</html>\n")).toBe(true);
  });

  it("names the file from the first heading, and falls back when there is none", () => {
    expect(
      htmlFromDocument(documentOf(heading(1, text("文档标题")), heading(2, text("小节")))),
    ).toContain("<title>文档标题</title>");
    expect(htmlFromDocument(documentOf(paragraph(text("没有标题"))))).toContain(
      "<title>无标题</title>",
    );
  });

  it("escapes the text and the link address", () => {
    const html = htmlFromDocument(
      documentOf(
        paragraph(text('<script>alert("x")</script> & 1 < 2')),
        paragraph(
          text("链接", [{ attrs: { href: 'https://example.com/?a=1&b="2"' }, type: "link" }]),
        ),
      ),
    );

    expect(html).toContain(
      "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; 1 &lt; 2</p>",
    );
    expect(html).toContain('<a href="https://example.com/?a=1&amp;b=&quot;2&quot;">链接</a>');
  });

  it("writes each mark as the element with that meaning", () => {
    const html = htmlFromDocument(
      documentOf(
        paragraph(text("加粗", [{ type: "bold" }])),
        paragraph(text("斜体", [{ type: "italic" }])),
        paragraph(text("下划线", [{ type: "underline" }])),
        paragraph(text("删除线", [{ type: "strike" }])),
        paragraph(text("行内代码", [{ type: "code" }])),
        paragraph(text("强调", [{ type: "bold" }, { type: "italic" }])),
      ),
    );

    expect(html).toContain("<p><strong>加粗</strong></p>");
    expect(html).toContain("<p><em>斜体</em></p>");
    expect(html).toContain("<p><u>下划线</u></p>");
    expect(html).toContain("<p><s>删除线</s></p>");
    expect(html).toContain("<p><code>行内代码</code></p>");
    expect(html).toContain("<p><strong><em>强调</em></strong></p>");
  });

  /**
   * 高亮 in the standalone file (#230).
   *
   * The mark is written as `<mark>`, and because the file opens away from this
   * site the fill has to travel with it: the embedded stylesheet carries one rule
   * per scheme, with the two measured token values read from `lib/tokens.ts` — the
   * one module that owns colour — and written out as literals. The expected bytes
   * below are spelled out rather than read from the token module, so a rule that
   * stops following it is a red test rather than a tautology. The file names
   * nothing it would have to fetch, so a highlighted paragraph still reads as one
   * with no network at all.
   */
  it("writes a highlight as <mark>, with its rule in the embedded stylesheet", () => {
    const html = htmlFromDocument(documentOf(paragraph(text("高亮", [{ type: "highlight" }]))));

    expect(html).toContain("<p><mark>高亮</mark></p>");
    expect(html).toContain("mark { background: #e9d391; color: #111111; }");
    expect(html).toContain("mark { background: #544730; color: #edebe8; }");
  });

  /**
   * Alignment in the standalone file (#230): a style on the block it belongs to.
   *
   * `left` is the absence of the attribute, so a document that says `left` — or
   * anything outside the three values — exports exactly like one that says
   * nothing. Only the two values the model can hold are written.
   */
  it("writes an alignment as the style on the block, and left as the absence of it", () => {
    const html = htmlFromDocument(
      documentOf(
        { attrs: { textAlign: "center" }, content: [text("居中")], type: "paragraph" },
        { attrs: { level: 2, textAlign: "right" }, content: [text("右")], type: "heading" },
        { attrs: { textAlign: "left" }, content: [text("左")], type: "paragraph" },
        { attrs: { textAlign: "justify" }, content: [text("两端")], type: "paragraph" },
      ),
    );

    expect(html).toContain('<p style="text-align: center">居中</p>');
    expect(html).toContain('<h2 style="text-align: right">右</h2>');
    expect(html).toContain("<p>左</p>");
    expect(html).toContain("<p>两端</p>");
  });

  /**
   * Alignment's scope is paragraphs and headings 1–3 (#230, F1), and the file is
   * where the scope is kept: the document can carry a level 4–6 heading (the
   * Markdown reader keeps whatever `#` run a file uses, and StarterKit's own input
   * rule turns `####` into one), but no toolbar row can name such a heading, so an
   * alignment it carries is not written. Dropping it is the recorded degradation
   * rather than a second, out-of-scope style in the exported file.
   */
  it("writes no alignment on a heading 4–6, which is outside the attribute's scope", () => {
    const html = htmlFromDocument(
      documentOf(
        { attrs: { level: 4, textAlign: "center" }, content: [text("四")], type: "heading" },
        { attrs: { level: 6, textAlign: "right" }, content: [text("六")], type: "heading" },
      ),
    );

    expect(html).toContain("<h4>四</h4>");
    expect(html).toContain("<h6>六</h6>");
    expect(html).not.toContain('style="text-align: center"');
    expect(html).not.toContain('style="text-align: right"');
  });

  it("writes lists, task items and a start number", () => {
    const html = htmlFromDocument(
      documentOf(
        {
          content: [
            {
              content: [
                paragraph(text("第二项")),
                {
                  content: [{ content: [paragraph(text("子项"))], type: "listItem" }],
                  type: "bulletList",
                },
              ],
              type: "listItem",
            },
          ],
          type: "bulletList",
        },
        {
          attrs: { start: 3 },
          content: [{ content: [paragraph(text("甲"))], type: "listItem" }],
          type: "orderedList",
        },
        {
          content: [
            { attrs: { checked: false }, content: [paragraph(text("未完成"))], type: "taskItem" },
            { attrs: { checked: true }, content: [paragraph(text("已完成"))], type: "taskItem" },
          ],
          type: "taskList",
        },
      ),
    );

    expect(html).toContain("<ul>\n<li>第二项\n<ul>\n<li>子项</li>\n</ul></li>\n</ul>");
    expect(html).toContain('<ol start="3">\n<li>甲</li>\n</ol>');
    expect(html).toContain('<ul class="task-list">');
    expect(html).toContain(
      '<li class="task-list-item"><input type="checkbox" disabled>未完成</li>',
    );
    expect(html).toContain(
      '<li class="task-list-item"><input type="checkbox" disabled checked>已完成</li>',
    );
  });

  it("writes a quote, a language-carrying code block, a rule and a hard break", () => {
    const html = htmlFromDocument(
      documentOf(
        { content: [paragraph(text("引用一句"))], type: "blockquote" },
        {
          attrs: { language: "ts" },
          content: [text("const answer = 42;")],
          type: "codeBlock",
        },
        paragraph(text("上"), { type: "hardBreak" }, text("下")),
        { type: "horizontalRule" },
      ),
    );

    expect(html).toContain("<blockquote>\n<p>引用一句</p>\n</blockquote>");
    expect(html).toContain('<pre><code class="language-ts">const answer = 42;</code></pre>');
    expect(html).toContain("<p>上<br>下</p>");
    expect(html).toContain("<hr>");
  });

  it("loads nothing: the stylesheet is in the file, not linked", () => {
    const html = htmlFromDocument(documentOf(paragraph(text("正文"))));

    expect(html).not.toContain("<link");
    expect(html).not.toContain("@import");
    expect(html).not.toContain("src=");
  });

  it("writes an image as an img carrying its bytes, its alt and the width the document keeps", () => {
    const html = htmlFromDocument(documentOf(image({ alt: "照片", width: 50 })));

    expect(html).toContain(`<img src="${IMAGE_SRC}" alt="照片" style="width: 50%">`);
    // The width is dropped from the Markdown file only; this one carries it.
    expect(html).toContain('style="width: 50%"');
  });

  it("defaults an image's width to the measure and keeps an empty alt empty", () => {
    const html = htmlFromDocument(documentOf(image()));

    expect(html).toContain(`<img src="${IMAGE_SRC}" alt="" style="width: 100%">`);
  });

  it("escapes an alt text and a source so neither can break the document", () => {
    const html = htmlFromDocument(
      documentOf(image({ alt: '他说"你好" & <b>', src: `data:image/png;base64,a"b&c` })),
    );

    expect(html).toContain(
      '<img src="data:image/png;base64,a&quot;b&amp;c" alt="他说&quot;你好&quot; &amp; &lt;b&gt;"',
    );
  });

  it("writes a semantic table with a header row and a body row", () => {
    const html = htmlFromDocument(
      documentOf(
        table(
          row(
            cell("tableHeader", paragraph(text("名称"))),
            cell("tableHeader", paragraph(text("数量"))),
          ),
          row(cell("tableCell", paragraph(text("甲"))), cell("tableCell", paragraph(text("1")))),
        ),
      ),
    );

    expect(html).toContain(
      [
        "<table>",
        "<thead>",
        "<tr>",
        "<th>名称</th>",
        "<th>数量</th>",
        "</tr>",
        "</thead>",
        "<tbody>",
        "<tr>",
        "<td>甲</td>",
        "<td>1</td>",
        "</tr>",
        "</tbody>",
        "</table>",
      ].join("\n"),
    );
    expect(html.match(/<th>/gu)).toHaveLength(2);
  });

  it("escapes a cell's text, so a cell that mentions a tag is text", () => {
    const html = htmlFromDocument(
      documentOf(table(row(cell("tableHeader", paragraph(text("<b>不是标签</b>")))))),
    );

    expect(html).toContain("<th>&lt;b&gt;不是标签&lt;/b&gt;</th>");
  });

  it("keeps both an image and a table inside the one complete document", () => {
    const html = htmlFromDocument(
      documentOf(
        heading(1, text("图文")),
        image({ alt: "照片" }),
        table(
          row(
            cell("tableHeader", paragraph(text("名称"))),
            cell("tableHeader", paragraph(text("数量"))),
          ),
          row(cell("tableCell", paragraph(text("甲"))), cell("tableCell", paragraph(text("1")))),
        ),
      ),
    );

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>图文</title>");
    expect(html).toContain(`<img src="${IMAGE_SRC}" alt="照片" style="width: 100%">`);
    expect(html).toContain("<th>名称</th>");
    expect(html).toContain("<td>1</td>");
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });
});
