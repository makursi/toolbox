/**
 * The table's rules: the grid's extent, the size a one-click insert uses, and the
 * words its two transient surfaces carry.
 *
 * It lives in the pure core because the table is the second command whose behaviour
 * is an interface rather than a TipTap chain (#217): what the picker offers, what a
 * chosen size reads as and what the contextual menu is called are data a unit test
 * can hold. Whether a row really arrives is the gate's question, because only
 * ProseMirror's schema can answer it.
 *
 * The seven actions' labels are here rather than in `editor/execute.ts` for the
 * reason the command table holds its own labels: the executor map is keyed by an id,
 * and the words a visitor reads are not the map's business.
 */

export interface TableSize {
  readonly columns: number;
  readonly rows: number;
}

/** The picker's outermost cell, and the whole of what it can insert. */
export const TABLE_MAX_ROWS = 10;
export const TABLE_MAX_COLUMNS = 10;

/**
 * The size the slash menu inserts.
 *
 * It is exported rather than written twice so the menu's one-step insert and the
 * picker's own reading cannot disagree about what "insert a table" means when
 * nothing more is asked.
 */
export const TABLE_DEFAULT_SIZE: TableSize = { columns: 3, rows: 3 };

/** The accessible name of the grid; the picker's heading says the same words. */
export const TABLE_GRID_LABEL = "表格大小";

/** What the picker says before a pointer or the keyboard chooses a cell. */
export const TABLE_GRID_HINT = "选择行数与列数";

/** The contextual menu's accessible name, so a screen reader does not read "a menu". */
export const TABLE_MENU_LABEL = "表格操作";

/** The sentence a chosen size reads as, in the picker's live summary. */
export function tableSizeLabel({ columns, rows }: TableSize): string {
  return `${rows} × ${columns} 表格`;
}

/** A grid cell's name: rows and columns in the order a visitor reads the grid. */
export function tableGridCellLabel({ columns, rows }: TableSize): string {
  return `${rows} 行 × ${columns} 列`;
}

/**
 * What the contextual menu's seven rows are and what they are called.
 *
 * The ids are the keys of `editor/execute.ts`'s table executor map, so the menu
 * cannot grow a row with no action: `Record<TableOperationId, ...>` fails the build.
 * 删除表格 is last and unlike the two deletions above it: it ends the table's
 * existence, and what it leaves behind is a paragraph.
 */
export type TableOperationId =
  | "add-row-before"
  | "add-row-after"
  | "add-column-before"
  | "add-column-after"
  | "delete-row"
  | "delete-column"
  | "delete-table";

export interface TableOperationSpec {
  readonly id: TableOperationId;
  readonly label: string;
}

export const TABLE_OPERATIONS: readonly TableOperationSpec[] = [
  { id: "add-row-before", label: "上方插入行" },
  { id: "add-row-after", label: "下方插入行" },
  { id: "add-column-before", label: "左侧插入列" },
  { id: "add-column-after", label: "右侧插入列" },
  { id: "delete-row", label: "删除行" },
  { id: "delete-column", label: "删除列" },
  { id: "delete-table", label: "删除表格" },
];
