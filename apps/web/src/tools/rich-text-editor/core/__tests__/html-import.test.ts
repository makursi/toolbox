import { describe, expect, it } from "vitest";

import { sanitizeHtml } from "@/tools/rich-text-editor/core/html-import";

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
