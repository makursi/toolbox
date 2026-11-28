import { describe, expect, it } from "vitest";

import {
  COMMANDS,
  commandById,
  commandsInGroup,
  filterCommands,
  slashCommands,
  type CommandGroup,
} from "@/tools/rich-text-editor/core/commands";

/**
 * The command table: the single list the toolbar and the slash menu render from.
 *
 * These tests hold the table's own contract, not the editor's: ids, labels,
 * keywords, order and the filter. Whether a command *works* is the browser
 * gate's question, because applying it is TipTap's, not this module's. The one
 * structural claim a unit test cannot make — that every id has an executor — is
 * a `Record<CommandId, ...>` in the toolbar, so `tsc` fails on a missing handler
 * before a test could.
 */
describe("the command table", () => {
  it("names every command exactly once", () => {
    const ids = COMMANDS.map((command) => command.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every command a label and at least one non-empty keyword", () => {
    for (const command of COMMANDS) {
      expect(command.label.trim(), command.id).not.toBe("");
      expect(command.keywords.length, command.id).toBeGreaterThan(0);

      for (const keyword of command.keywords) {
        expect(keyword.trim(), command.id).not.toBe("");
      }
    }
  });

  it("keeps every group's commands in the table's order", () => {
    const groups: readonly CommandGroup[] = ["history", "block", "mark", "list", "align", "insert"];
    let previous = -1;

    for (const group of groups) {
      for (const command of commandsInGroup(group)) {
        const index = COMMANDS.indexOf(command);
        expect(index, command.id).toBeGreaterThan(previous);
        previous = index;
      }
    }
  });

  it("matches a keyword and returns the table's order", () => {
    expect(filterCommands("标题").map((command) => command.id)).toEqual([
      "heading-1",
      "heading-2",
      "heading-3",
    ]);
    expect(filterCommands("列表").map((command) => command.id)).toEqual([
      "bullet-list",
      "ordered-list",
      "task-list",
    ]);
    expect(filterCommands("bold").map((command) => command.id)).toEqual(["bold"]);
    expect(filterCommands("H1").map((command) => command.id)).toEqual(["heading-1"]);
  });

  it("returns the whole table for an empty query and nothing for a miss", () => {
    expect(filterCommands("")).toEqual(COMMANDS);
    expect(filterCommands("   ")).toEqual(COMMANDS);
    expect(filterCommands("没有这个命令")).toEqual([]);
  });

  it("names the block every command applies", () => {
    for (const command of COMMANDS) {
      expect(command.block.trim(), command.id).not.toBe("");
    }
  });

  it("looks a command up by the id the executor map is keyed by", () => {
    expect(commandById("heading-2").label).toBe("标题 2");
    expect(commandById("link").block).toBe("link");
  });

  it("appends the image and the table to the insert group, after the link", () => {
    const insert = commandsInGroup("insert").map((command) => command.id);

    expect(insert).toEqual([
      "blockquote",
      "code-block",
      "horizontal-rule",
      "link",
      "image",
      "table",
    ]);
    expect(commandById("image").label).toBe("图片");
    expect(commandById("image").block).toBe("image");
    expect(commandById("table").label).toBe("表格");
    expect(commandById("table").block).toBe("table");
  });
});

describe("the slash menu's commands", () => {
  /**
   * What a slash menu offers on an empty query: the rows that produce a block, in
   * the table's order. Spelled out rather than derived, so a mark, an action or a
   * document command leaking into the menu is a red test rather than a coincidence.
   *
   * 图片 and 表格 are the last two rows, and both are interface-shaped (#216, #217):
   * the slash menu lists them like block commands even though neither runs a chain.
   * 图片's picker is opened by the surface that owns the file input; 表格 needs no
   * second step here, so the menu inserts the documented 3 × 3 directly.
   */
  it("offers the block commands and nothing that needs a selection or the document", () => {
    expect(slashCommands("").map((command) => command.id)).toEqual([
      "paragraph",
      "heading-1",
      "heading-2",
      "heading-3",
      "bullet-list",
      "ordered-list",
      "task-list",
      "blockquote",
      "code-block",
      "horizontal-rule",
      "image",
      "table",
    ]);
  });

  it("reaches 表格 by its Chinese word and by its English one", () => {
    expect(slashCommands("表格").map((command) => command.id)).toEqual(["table"]);
    expect(slashCommands("table").map((command) => command.id)).toEqual(["table"]);
  });

  it("filters by the same keywords as the pinned toolbar", () => {
    expect(slashCommands("引用").map((command) => command.id)).toEqual(["blockquote"]);
    expect(slashCommands("H2").map((command) => command.id)).toEqual(["heading-2"]);
    expect(slashCommands("列表").map((command) => command.id)).toEqual([
      "bullet-list",
      "ordered-list",
      "task-list",
    ]);
    expect(slashCommands("图片").map((command) => command.id)).toEqual(["image"]);
  });

  it("cannot reach a mark, a link, an alignment or a whole-document command", () => {
    for (const query of ["加粗", "链接", "撤销", "对齐", "居中", ""]) {
      const ids = slashCommands(query).map((command) => command.id);

      for (const excluded of [
        "bold",
        "italic",
        "highlight",
        "link",
        "undo",
        "redo",
        "align-left",
        "align-center",
        "align-right",
      ]) {
        expect(ids, `${query} reached ${excluded}`).not.toContain(excluded);
      }
    }
  });

  it("keeps the table's order and returns nothing for a miss", () => {
    const ids = slashCommands("标题").map((command) => command.id);
    expect(ids).toEqual(["heading-1", "heading-2", "heading-3"]);

    // The menu keeps the table's order, which is what makes a filtered list read
    // the same way as the whole one.
    const tableOrder = COMMANDS.map((command) => command.id);
    let previous = -1;

    for (const id of slashCommands("").map((command) => command.id)) {
      const index = tableOrder.indexOf(id);
      expect(index, id).toBeGreaterThan(previous);
      previous = index;
    }

    expect(slashCommands("没有这个命令")).toEqual([]);
  });
});

/**
 * The image row, and why it is a row rather than a control beside the table (#216).
 *
 * 图片 is an insert action, so it belongs in the insert group like 引用, 链接 and the
 * rule; its `block` is what puts it in the slash menu. The command is
 * interface-shaped: the executor map has no chain for it (the same exception as
 * 链接 and 表格), so the row's contract is only what this test can hold — the label
 * a visitor reads, the group it renders in, the keywords the filter matches, and
 * the construct it produces.
 */
describe("the image command", () => {
  it("is the insert group's 图片, and produces an image block", () => {
    expect(commandById("image")).toMatchObject({
      block: "image",
      group: "insert",
      label: "图片",
    });
  });

  it("is reachable by the Chinese word and the English one", () => {
    expect(filterCommands("图片").map((command) => command.id)).toEqual(["image"]);
    expect(filterCommands("image").map((command) => command.id)).toEqual(["image"]);
    expect(filterCommands("照片").map((command) => command.id)).toEqual(["image"]);
  });

  it("sits between the link and the table in the insert group", () => {
    const insert = commandsInGroup("insert").map((command) => command.id);

    expect(insert.indexOf("link")).toBeLessThan(insert.indexOf("image"));
    expect(insert.indexOf("image")).toBeLessThan(insert.indexOf("table"));
  });

  it("is in the slash menu second to last, without dragging the link in with it", () => {
    const ids = slashCommands("").map((command) => command.id);

    expect(ids.at(-1)).toBe("table");
    expect(ids.at(-2)).toBe("image");
    expect(ids).not.toContain("link");
  });
});

/**
 * The sixth inline mark (#230).
 *
 * 高亮 is a mark like the other five, so it belongs in the mark group and the two
 * toolbars render it from the table. It is not a colour: the command carries the
 * name of the construct it applies and nothing else, and the fill is the site's
 * token, so the document has no colour to disagree with the export about.
 */
describe("the highlight command", () => {
  it("is the mark group's sixth row, after 行内代码", () => {
    expect(commandsInGroup("mark").map((command) => command.id)).toEqual([
      "bold",
      "italic",
      "underline",
      "strike",
      "code",
      "highlight",
    ]);
    expect(commandById("highlight")).toMatchObject({
      block: "highlight",
      group: "mark",
      label: "高亮",
    });
  });

  it("is reachable by its Chinese word and its English one", () => {
    expect(filterCommands("高亮").map((command) => command.id)).toEqual(["highlight"]);
    expect(filterCommands("highlight").map((command) => command.id)).toEqual(["highlight"]);
  });
});

/**
 * Alignment (#230): a new group of three rows, and a `block` value the slash
 * menu's predicate must not know.
 *
 * The menu offers the constructs that produce a block. Alignment changes a block
 * that already exists, so it is not one of them: the new `block` value is outside
 * `SLASH_BLOCKS` on purpose, and that is what keeps it out of both the slash menu
 * and the 块类型 popover without either one naming alignment.
 */
describe("the alignment commands", () => {
  it("is its own group of three, in the order 左 / 居中 / 右", () => {
    expect(commandsInGroup("align").map((command) => command.id)).toEqual([
      "align-left",
      "align-center",
      "align-right",
    ]);
    expect(commandsInGroup("align").map((command) => command.label)).toEqual(["左", "居中", "右"]);
  });

  it("names a construct the slash menu cannot produce, by row or by block", () => {
    const offered = slashCommands("");

    for (const command of commandsInGroup("align")) {
      expect(offered, command.id).not.toContain(command);
      expect(
        offered.map((one) => one.block),
        `${command.id}'s block leaked into the slash menu`,
      ).not.toContain(command.block);
    }
  });

  it("is reachable by its Chinese word and its English one", () => {
    expect(filterCommands("对齐").map((command) => command.id)).toEqual([
      "align-left",
      "align-center",
      "align-right",
    ]);
    expect(filterCommands("align").map((command) => command.id)).toEqual([
      "align-left",
      "align-center",
      "align-right",
    ]);
  });
});
