import { describe, expect, it } from "vitest";

import {
  TABLE_DEFAULT_SIZE,
  TABLE_GRID_HINT,
  TABLE_GRID_LABEL,
  TABLE_MAX_COLUMNS,
  TABLE_MAX_ROWS,
  TABLE_MENU_LABEL,
  TABLE_OPERATIONS,
  tableGridCellLabel,
  tableSizeLabel,
} from "@/tools/rich-text-editor/core/table";

/**
 * The table's rules, held where a table does not need a browser.
 *
 * A table is the one construct this Tool inserts through an interface rather than a
 * chain (#217), so what a unit test can own is the data behind that interface: how
 * far the grid goes, what size a one-click insert uses, the words each action
 * carries, and the name every cell of the grid has. Whether an action really adds a
 * row is the gate's question, because only ProseMirror can answer it.
 */
describe("the table grid's rules", () => {
  it("offers one to ten rows and one to ten columns", () => {
    expect(TABLE_MAX_ROWS).toBe(10);
    expect(TABLE_MAX_COLUMNS).toBe(10);
  });

  it("defaults to the 3 × 3 the slash menu inserts", () => {
    expect(TABLE_DEFAULT_SIZE).toEqual({ columns: 3, rows: 3 });
  });

  it("names the size the pointer is over, and the size it commits", () => {
    expect(tableSizeLabel({ columns: 3, rows: 2 })).toBe("2 × 3 表格");
    expect(tableSizeLabel({ columns: 10, rows: 10 })).toBe("10 × 10 表格");
  });

  it("gives every cell of the grid its own accessible name", () => {
    const names = new Set<string>();

    for (let rows = 1; rows <= TABLE_MAX_ROWS; rows += 1) {
      for (let columns = 1; columns <= TABLE_MAX_COLUMNS; columns += 1) {
        names.add(tableGridCellLabel({ columns, rows }));
      }
    }

    // One name per cell is what makes 100 buttons readable to a screen reader: a
    // repeated name would leave a visitor choosing between 100 identical controls.
    expect(names.size).toBe(TABLE_MAX_ROWS * TABLE_MAX_COLUMNS);
    expect(tableGridCellLabel({ columns: 1, rows: 1 })).toBe("1 行 × 1 列");
    expect(tableGridCellLabel({ columns: 10, rows: 2 })).toBe("2 行 × 10 列");
  });
});

/**
 * The transient surfaces' words.
 *
 * They live in this layer for the reason every sentence in the Tool does: they are
 * in no pre-rendered HTML (the picker and the menu exist only while open), so
 * holding them here is what lets the punctuation rule be read without a browser
 * (`apps/web/docs/design/copy.md`).
 */
describe("the table's copy", () => {
  const sentences = [TABLE_GRID_LABEL, TABLE_GRID_HINT, TABLE_MENU_LABEL];

  it("names the picker, its hint and the contextual menu", () => {
    expect(TABLE_GRID_LABEL).toBe("表格大小");
    expect(TABLE_GRID_HINT).toBe("选择行数与列数");
    expect(TABLE_MENU_LABEL).toBe("表格操作");
  });

  it("carries no em dash, en dash or Chinese dash", () => {
    for (const sentence of sentences) {
      expect(sentence).not.toMatch(/[—–]/);
      expect(sentence).not.toContain("——");
    }
  });
});

/**
 * The contextual menu's seven actions.
 *
 * The labels are spelled out and the order is asserted because both are the
 * ticket's contract: seven rows, in the order a writer reads them (rows above and
 * below, columns left and right, then the three deletions). The ids are what the
 * executor map is keyed by, so a missing one is a `tsc` error in that map rather
 * than a menu row that does nothing.
 */
describe("the table menu", () => {
  it("lists exactly the seven actions, in the order the menu draws them", () => {
    expect(TABLE_OPERATIONS.map((operation) => operation.label)).toEqual([
      "上方插入行",
      "下方插入行",
      "左侧插入列",
      "右侧插入列",
      "删除行",
      "删除列",
      "删除表格",
    ]);
  });

  it("names each action once", () => {
    const ids = TABLE_OPERATIONS.map((operation) => operation.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(7);
  });

  it("keeps the labels free of the banned punctuation", () => {
    for (const operation of TABLE_OPERATIONS) {
      expect(operation.label, operation.id).not.toMatch(/[—–]/);
      expect(operation.label, operation.id).not.toContain("——");
    }
  });
});
