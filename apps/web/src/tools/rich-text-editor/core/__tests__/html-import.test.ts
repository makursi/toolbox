import { describe, expect, it } from "vitest";

import { MAX_IMAGE_BYTES } from "@/tools/rich-text-editor/core/admission";
import { htmlFromDocument } from "@/tools/rich-text-editor/core/html";
import { importHtml, sanitizeHtml } from "@/tools/rich-text-editor/core/html-import";

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

/**
 * The HTML sanitiser, judged by the fragment it hands to TipTap's parser.
 *
 * The shapes below are the two documents this Tool meets most: a complete file
 * from elsewhere (with a head, a stylesheet and a script it must not carry), and
 * the standalone HTML this Tool exports, whose task list is written as a plain
 * `<ul class="task-list">` with checkboxes and has to come back as the editor's
 * own task-list markup so an exported file can be imported again.
 *
 * The security cases are about what must be *absent*: no script, no style, no
 * event handler, no `javascript:` destination, no image the schema has no node
 * for.
 */

describe("sanitizeHtml", () => {
  it("keeps the document's blocks and drops the head, stylesheet and script", () => {
    const source = [
      "<!doctype html>",
      '<html lang="zh-CN"><head>',
      "<title>忽略的标题</title>",
      "<style>p { color: red }</style>",
      "<script>window.__importPwned = true</script>",
      "</head><body><article>",
      "<h1>HTML 导入</h1>",
      '<p>一段<strong>加粗</strong>与<a href="https://example.com">链接</a></p>',
      "<ul><li>一</li><li>二</li></ul>",
      "<blockquote>引用</blockquote>",
      '<pre><code class="language-js">const a = 1;</code></pre>',
      "<hr>",
      "</article></body></html>",
    ].join("");

    expect(sanitizeHtml(source)).toBe(
      [
        "<h1>HTML 导入</h1>",
        '<p>一段<strong>加粗</strong>与<a href="https://example.com">链接</a></p>',
        "<ul><li>一</li><li>二</li></ul>",
        "<blockquote>引用</blockquote>",
        '<pre><code class="language-js">const a = 1;</code></pre>',
        "<hr>",
      ].join(""),
    );
  });

  it("reads the export's task list back into the editor's own markup", () => {
    const source =
      '<ul class="task-list"><li class="task-list-item"><input type="checkbox" checked disabled>已完成</li>' +
      '<li class="task-list-item"><input type="checkbox" disabled>未完成</li></ul>';

    expect(sanitizeHtml(source)).toBe(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="true">已完成</li>' +
        '<li data-type="taskItem" data-checked="false">未完成</li></ul>',
    );
  });

  it("also reads the editor's own task-list attributes", () => {
    expect(
      sanitizeHtml(
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>完成</p></li></ul>',
      ),
    ).toBe(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>完成</p></li></ul>',
    );
  });

  it("drops scripts, styles, images and event handlers, and unwraps an unsafe link", () => {
    const source =
      '<p onclick="alert(1)" style="color: red">文本<img src="x" onerror="alert(2)">' +
      "<script>alert(3)</script><style>p { color: red }</style>" +
      '<a href="javascript:alert(4)">点击</a>' +
      '<a href="https://ok.example/a?b=1&amp;c=2">好</a></p>';

    const sanitized = sanitizeHtml(source);

    expect(sanitized).toBe('<p>文本点击<a href="https://ok.example/a?b=1&amp;c=2">好</a></p>');
    expect(sanitized).not.toContain("script");
    expect(sanitized).not.toContain("onclick");
    expect(sanitized).not.toContain("onerror");
    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).not.toContain("<img");
  });

  it("unwraps the boxes the schema has no node for, and keeps their words", () => {
    expect(sanitizeHtml("<div>第一段<br>第二行</div><span>&lt;标签&gt; &amp; 文本</span>")).toBe(
      "第一段<br>第二行&lt;标签&gt; &amp; 文本",
    );
  });

  it("keeps a nested list's structure", () => {
    expect(sanitizeHtml("<ul><li>第一项<ul><li>嵌套项</li></ul></li></ul>")).toBe(
      "<ul><li>第一项<ul><li>嵌套项</li></ul></li></ul>",
    );
  });

  it("keeps a relative link and an ordered list's starting number", () => {
    expect(sanitizeHtml('<p><a href="/docs">文档</a></p><ol start="3"><li>三</li></ol>')).toBe(
      '<p><a href="/docs">文档</a></p><ol start="3"><li>三</li></ol>',
    );
  });

  it("drops comments and a doctype", () => {
    expect(sanitizeHtml("<!-- 注释 --><!doctype html><p>正文</p>")).toBe("<p>正文</p>");
  });

  it("returns plain text unchanged, and nothing for a script-only document", () => {
    expect(sanitizeHtml("普通文本，没有标签。")).toBe("普通文本，没有标签。");
    expect(sanitizeHtml("<script>window.__nothing = true</script>")).toBe("");
    expect(sanitizeHtml("")).toBe("");
  });

  it("does not throw on malformed markup", () => {
    expect(() => sanitizeHtml("<p>未闭合<div><span")).not.toThrow();
    expect(sanitizeHtml("<p>未闭合<div><span")).toContain("未闭合");
    expect(() => sanitizeHtml("</div></p>孤立闭合 < > <!")).not.toThrow();
    expect(() => sanitizeHtml("<ul><li>未闭合")).not.toThrow();
  });
});

/**
 * Tables and images (#220).
 *
 * The writer's own markup read the other way: the table survives as a table, with
 * the `thead`/`tbody` wrapper taken off because the document's table is rows of
 * cells and its first row is the header; the image survives only when it carries
 * bytes the document can hold, and a source the page cannot draw leaves the alt text
 * it was written with. The security cases are the same ones as above: a script or an
 * event handler inside a cell is dropped by the one rule that drops it anywhere.
 */
describe("sanitizeHtml, tables and images", () => {
  it("keeps a table, with a thead/tbody wrapper taken off", () => {
    expect(
      sanitizeHtml(
        "<table><thead><tr><th>项目</th><th>数量</th></tr></thead>" +
          "<tbody><tr><td>甲</td><td>1</td></tr></tbody></table>",
      ),
    ).toBe("<table><tr><th>项目</th><th>数量</th></tr><tr><td>甲</td><td>1</td></tr></table>");
  });

  it("keeps a table with no th, and gives an empty cell the paragraph its schema needs", () => {
    expect(sanitizeHtml("<table><tr><td>甲</td><td></td></tr></table>")).toBe(
      "<table><tr><td>甲</td><td><p></p></td></tr></table>",
    );
  });

  it("drops a script and keeps a data image inside a cell", () => {
    const source =
      "<table><tr><td>甲<script>window.__cellPwned = true</script></td>" +
      `<td><img src="${PNG_DATA_URL}" alt="照片" onerror="alert(1)"></td></tr></table>`;

    expect(sanitizeHtml(source)).toBe(
      `<table><tr><td>甲</td><td><img src="${PNG_DATA_URL}" alt="照片"></td></tr></table>`,
    );
    expect(sanitizeHtml(source)).not.toContain("script");
    expect(sanitizeHtml(source)).not.toContain("onerror");
  });

  it("keeps a data image and the percentage width this Tool writes on it", () => {
    expect(
      sanitizeHtml(`<p><img src="${PNG_DATA_URL}" alt="照片" style="width: 50%; border: 0"></p>`),
    ).toBe(`<p><img src="${PNG_DATA_URL}" alt="照片" style="width: 50%"></p>`);
  });

  it("drops a remote image and leaves its alt text as text", () => {
    expect(sanitizeHtml('<p>前<img src="https://example.com/x.png" alt="远程照片">后</p>')).toBe(
      "<p>前远程照片后</p>",
    );
    // With no alt there is nothing left of it, which is not an empty node.
    expect(sanitizeHtml('<p>前<img src="https://example.com/x.png">后</p>')).toBe("<p>前后</p>");
  });

  it("refuses an image over the per-file limit and answers the rule it broke", () => {
    const imported = importHtml(
      `<p>前<img src="${dataUrlOf(MAX_IMAGE_BYTES + 1)}" alt="超大图">后</p>`,
    );

    expect(imported.html).toBe("<p>前超大图后</p>");
    expect(imported.refusals).toEqual(["size"]);
  });

  it("refuses the eleventh image, so the fragment holds ten", () => {
    const source = Array.from(
      { length: 11 },
      (_, index) => `<p><img src="${PNG_DATA_URL}" alt="第${index + 1}张"></p>`,
    ).join("");
    const imported = importHtml(source);

    expect((imported.html.match(/<img/gu) ?? []).length).toBe(10);
    expect(imported.html).toContain("第11张");
    expect(imported.html).not.toContain('alt="第11张"');
    expect(imported.refusals).toEqual(["count"]);
  });

  it("keeps the image and the table the HTML writer wrote, so an exported file imports again", () => {
    const document = {
      content: [
        { attrs: { level: 1 }, content: [{ text: "图文导出", type: "text" }], type: "heading" },
        { attrs: { alt: "照片", src: PNG_DATA_URL, width: 50 }, type: "image" },
        {
          content: [
            {
              content: [
                {
                  content: [{ content: [{ text: "项目", type: "text" }], type: "paragraph" }],
                  type: "tableHeader",
                },
                {
                  content: [{ content: [{ text: "数量", type: "text" }], type: "paragraph" }],
                  type: "tableHeader",
                },
              ],
              type: "tableRow",
            },
            {
              content: [
                {
                  content: [{ content: [{ text: "甲", type: "text" }], type: "paragraph" }],
                  type: "tableCell",
                },
                {
                  content: [{ content: [{ text: "1", type: "text" }], type: "paragraph" }],
                  type: "tableCell",
                },
              ],
              type: "tableRow",
            },
          ],
          type: "table",
        },
      ],
      type: "doc",
    };
    const fragment = sanitizeHtml(htmlFromDocument(document));

    // The writer's own markup comes back as markup: the image with its width, and
    // the table as rows of cells. The `thead`/`tbody` wrappers are the export's
    // shape, not the document's — its table is rows, and the reader takes them off.
    expect(fragment).toContain(`<img src="${PNG_DATA_URL}" alt="照片" style="width: 50%">`);
    expect(fragment).toContain("<table>");
    expect(fragment).toContain("<th>项目</th>");
    expect(fragment).toContain("<tr><td>甲</td><td>1</td></tr>");
    expect(fragment).not.toContain("<article>");
    expect(fragment).not.toContain("<thead>");
  });
});

/**
 * The mark and the alignment (#230).
 *
 * The sanitiser's job is to keep what the editor's schema has a mark or an
 * attribute for, and to hand TipTap the canonical form: `<mark>`, and the one
 * alignment spelling `text-align: center`. A `left` is the absence of the
 * attribute, so it leaves no style behind; a `justify` is outside the model and
 * leaves none either. The last case is the round trip the ticket asks for: the
 * writer's own bytes come back as the same markup.
 */
describe("sanitizeHtml, the mark and the alignment", () => {
  it("keeps a mark the export writes", () => {
    expect(sanitizeHtml("<p>前<mark>高亮</mark>后</p>")).toBe("<p>前<mark>高亮</mark>后</p>");
    expect(sanitizeHtml("<p><mark><strong>叠</strong></mark></p>")).toBe(
      "<p><mark><strong>叠</strong></mark></p>",
    );
  });

  it("reads text-align from a paragraph or heading style, and re-emits only the canonical form", () => {
    expect(sanitizeHtml('<p style="TEXT-ALIGN: CENTER; color: red">居中</p>')).toBe(
      '<p style="text-align: center">居中</p>',
    );
    expect(sanitizeHtml('<h2 style="text-align:right">右</h2>')).toBe(
      '<h2 style="text-align: right">右</h2>',
    );
    expect(sanitizeHtml('<p style="text-align: left">左</p>')).toBe("<p>左</p>");
    expect(sanitizeHtml('<p style="text-align: justify">两端</p>')).toBe("<p>两端</p>");
    expect(sanitizeHtml('<mark style="text-align: center">标记</mark>')).toBe("<mark>标记</mark>");
  });

  it("keeps the highlight and the alignment the writer wrote, so an exported file imports again", () => {
    const document = {
      content: [
        {
          attrs: { level: 1, textAlign: "center" },
          content: [{ text: "居中标题", type: "text" }],
          type: "heading",
        },
        {
          attrs: { textAlign: "right" },
          content: [{ marks: [{ type: "highlight" }], text: "高亮", type: "text" }],
          type: "paragraph",
        },
      ],
      type: "doc",
    };
    const fragment = sanitizeHtml(htmlFromDocument(document));

    expect(fragment).toContain('<h1 style="text-align: center">居中标题</h1>');
    expect(fragment).toContain('<p style="text-align: right"><mark>高亮</mark></p>');
  });
});
