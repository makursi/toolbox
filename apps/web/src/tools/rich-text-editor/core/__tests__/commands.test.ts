import { describe, expect, it } from "vitest";

import {
  COMMANDS,
  commandById,
  commandsInGroup,
  filterCommands,
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
    const groups: readonly CommandGroup[] = ["history", "block", "mark", "list", "insert", "file"];
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
});
