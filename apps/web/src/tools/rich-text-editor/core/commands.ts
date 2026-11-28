/**
 * The one command table: every block, mark, list and insert this editor offers,
 * in the order the toolbar draws them.
 *
 * The table is pure data plus the filter the slash menu will use (#208). Nothing
 * here knows about TipTap: a command says what it applies to and what it is
 * called, and the toolbar's executor map turns its id into a TipTap chain. One
 * table is the point: a command added here is a command the toolbar, the slash
 * menu and the block menu's block-type rows all render, so they cannot disagree
 * about what exists.
 *
 * The `block` field names the document construct a command applies: a node name
 * for a block, a mark name for an inline command, and `document` for the ones
 * that act on the whole document. It is the field the slash menu reads when it
 * has to say what a command will produce, not a description of the executor.
 */

export type CommandGroup = "history" | "block" | "mark" | "list" | "align" | "insert";

export type CommandId =
  | "undo"
  | "redo"
  | "paragraph"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "code"
  | "highlight"
  | "bullet-list"
  | "ordered-list"
  | "task-list"
  | "align-left"
  | "align-center"
  | "align-right"
  | "blockquote"
  | "code-block"
  | "horizontal-rule"
  | "link"
  | "image"
  | "table";

export type CommandBlock =
  | "paragraph"
  | "heading"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "code"
  | "highlight"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "textBlock"
  | "blockquote"
  | "codeBlock"
  | "horizontalRule"
  | "link"
  | "image"
  | "table"
  | "document";

export interface CommandSpec {
  /** What the executor map is keyed by, and what the slash menu applies. */
  readonly id: CommandId;
  /** The words a visitor reads, on the toolbar and in the slash menu. */
  readonly label: string;
  /** Which part of the toolbar renders it; the slash menu groups by this too. */
  readonly group: CommandGroup;
  /** Chinese and English words the filter matches, including the label's own. */
  readonly keywords: readonly string[];
  /** The document construct the command applies, for the slash menu's summary. */
  readonly block: CommandBlock;
  /** A Phosphor literal, compiled into the CSS at build time. */
  readonly icon: string;
}

/**
 * The table, in the toolbar's order.
 *
 * `history` is first and `insert` last because that is where the toolbar puts
 * them: undo/redo at the left, the insert actions before the file menu at the
 * right. The middle groups are the block menu, the inline marks, the lists and
 * the alignment popover (`align`, #230), each in this table's own order.
 *
 * The file menu's 导入, 导出 and 清空 are not rows here. They are not editor
 * commands: two of them surround the document instead of changing it, and 清空 is
 * the draft store's removal rather than a `setContent` (the two `setContent`
 * definitions this table once carried disagreed). They live in
 * `file-menu/file-menu.tsx`, which is the one surface that draws them.
 *
 * Keywords are both the Chinese word and the English one a writer may type
 * after a slash: `#208` filters this list as the visitor types, and a command
 * that only matched its label would be unreachable to anyone typing `h1`.
 */
export const COMMANDS: readonly CommandSpec[] = [
  {
    block: "document",
    group: "history",
    icon: "icon-[ph--arrow-u-up-left-bold]",
    id: "undo",
    keywords: ["撤销", "回退", "undo"],
    label: "撤销",
  },
  {
    block: "document",
    group: "history",
    icon: "icon-[ph--arrow-u-up-right-bold]",
    id: "redo",
    keywords: ["重做", "恢复", "redo"],
    label: "重做",
  },
  {
    block: "paragraph",
    group: "block",
    icon: "icon-[ph--paragraph-bold]",
    id: "paragraph",
    keywords: ["正文", "段落", "paragraph", "text", "p"],
    label: "正文",
  },
  {
    block: "heading",
    group: "block",
    icon: "icon-[ph--text-h-one-bold]",
    id: "heading-1",
    keywords: ["标题", "一级标题", "heading", "h1"],
    label: "标题 1",
  },
  {
    block: "heading",
    group: "block",
    icon: "icon-[ph--text-h-two-bold]",
    id: "heading-2",
    keywords: ["标题", "二级标题", "heading", "h2"],
    label: "标题 2",
  },
  {
    block: "heading",
    group: "block",
    icon: "icon-[ph--text-h-three-bold]",
    id: "heading-3",
    keywords: ["标题", "三级标题", "heading", "h3"],
    label: "标题 3",
  },
  {
    block: "bold",
    group: "mark",
    icon: "icon-[ph--text-b-bold]",
    id: "bold",
    keywords: ["加粗", "粗体", "bold", "b"],
    label: "加粗",
  },
  {
    block: "italic",
    group: "mark",
    icon: "icon-[ph--text-italic-bold]",
    id: "italic",
    keywords: ["斜体", "倾斜", "italic", "i"],
    label: "斜体",
  },
  {
    block: "underline",
    group: "mark",
    icon: "icon-[ph--text-underline-bold]",
    id: "underline",
    keywords: ["下划线", "underline", "u"],
    label: "下划线",
  },
  {
    block: "strike",
    group: "mark",
    icon: "icon-[ph--text-strikethrough-bold]",
    id: "strike",
    keywords: ["删除线", "strike", "strikethrough", "s"],
    label: "删除线",
  },
  {
    block: "code",
    group: "mark",
    icon: "icon-[ph--code-bold]",
    id: "code",
    keywords: ["行内代码", "代码", "code", "inline code"],
    label: "行内代码",
  },
  /*
   * 高亮 is the sixth mark (#230), and it is a mark rather than a colour: the
   * command says a run is highlighted, and the fill behind it is the site's
   * token, so the document carries no colour for either export to disagree with.
   * It joins this group, which is what makes both the pinned toolbar and the
   * selection toolbar render it without a second list.
   */
  {
    block: "highlight",
    group: "mark",
    icon: "icon-[ph--highlighter-bold]",
    id: "highlight",
    keywords: ["高亮", "标记", "highlight", "marker"],
    label: "高亮",
  },
  {
    block: "bulletList",
    group: "list",
    icon: "icon-[ph--list-bullets-bold]",
    id: "bullet-list",
    keywords: ["项目符号列表", "项目符号", "无序列表", "bullet", "ul", "list"],
    label: "项目符号列表",
  },
  {
    block: "orderedList",
    group: "list",
    icon: "icon-[ph--list-numbers-bold]",
    id: "ordered-list",
    keywords: ["编号列表", "编号", "有序列表", "ordered", "ol", "number"],
    label: "编号列表",
  },
  {
    block: "taskList",
    group: "list",
    icon: "icon-[ph--list-checks-bold]",
    id: "task-list",
    keywords: ["任务列表", "任务", "待办", "task", "todo", "check"],
    label: "任务列表",
  },
  /*
   * Alignment (#230): a group of three rows whose `block` is `textBlock`, a
   * construct the slash menu's set deliberately does not contain. The menu offers
   * commands that produce a block; alignment changes one that already exists, so
   * it must not appear there — nor in the 块类型 popover, which reads the same
   * predicate. The three rows are one popover in the toolbar, not three controls:
   * the column is already at its width and these are one attribute's three values.
   *
   * Left is the absence of the attribute, so its executor unsets it rather than
   * setting `left`; the command still exists because the toolbar has to offer the
   * value, and `aria-current` has to be able to name it.
   */
  {
    block: "textBlock",
    group: "align",
    icon: "icon-[ph--text-align-left-bold]",
    id: "align-left",
    keywords: ["对齐", "左对齐", "左", "align", "left"],
    label: "左",
  },
  {
    block: "textBlock",
    group: "align",
    icon: "icon-[ph--text-align-center-bold]",
    id: "align-center",
    keywords: ["对齐", "居中", "中对齐", "align", "center", "middle"],
    label: "居中",
  },
  {
    block: "textBlock",
    group: "align",
    icon: "icon-[ph--text-align-right-bold]",
    id: "align-right",
    keywords: ["对齐", "右对齐", "右", "align", "right"],
    label: "右",
  },
  {
    block: "blockquote",
    group: "insert",
    icon: "icon-[ph--quotes-bold]",
    id: "blockquote",
    keywords: ["引用", "blockquote", "quote"],
    label: "引用",
  },
  {
    block: "codeBlock",
    group: "insert",
    icon: "icon-[ph--code-block-bold]",
    id: "code-block",
    keywords: ["代码块", "code block", "pre"],
    label: "代码块",
  },
  {
    block: "horizontalRule",
    group: "insert",
    icon: "icon-[ph--minus-bold]",
    id: "horizontal-rule",
    keywords: ["分隔线", "分割线", "horizontal rule", "hr", "divider"],
    label: "分隔线",
  },
  {
    block: "link",
    group: "insert",
    icon: "icon-[ph--link-bold]",
    id: "link",
    keywords: ["链接", "link", "url"],
    label: "链接",
  },
  /*
   * 图片 and 表格 are the two interface-shaped insert commands (#216, #217), and
   * they follow 链接 for the same reason: what they do is an interface, not a
   * TipTap chain. Neither is in the executor map, so `runCommand` answers `false`
   * for both and the surface that owns the interface runs it: 图片 opens the
   * toolbar's file input, and 表格 opens the grid picker outside a table and the
   * contextual 表格 menu inside one. 表格 while the caret is in a table is a state
   * of one command, not a second row.
   */
  {
    block: "image",
    group: "insert",
    icon: "icon-[ph--image-bold]",
    id: "image",
    keywords: ["图片", "图像", "照片", "image", "photo", "picture"],
    label: "图片",
  },
  {
    block: "table",
    group: "insert",
    icon: "icon-[ph--table-bold]",
    id: "table",
    keywords: ["表格", "table", "grid"],
    label: "表格",
  },
];

/** The commands in one group, in the table's order. */
export function commandsInGroup(group: CommandGroup): readonly CommandSpec[] {
  return COMMANDS.filter((command) => command.group === group);
}

/** One command by id, for a place that names it rather than rendering the table. */
export function commandById(id: CommandId): CommandSpec {
  const command = COMMANDS.find((one) => one.id === id);
  if (command === undefined) throw new Error(`no command named ${id}`);
  return command;
}

/** The block group's four rows, by the heading level each one produces. */
const HEADING_COMMANDS: Readonly<Record<number, CommandId>> = {
  1: "heading-1",
  2: "heading-2",
  3: "heading-3",
};

/**
 * The command that makes a heading of `level`, or `null` for one the table has no
 * row for.
 *
 * The table's block rows are 正文 and 标题 1–3, while the document can hold a level
 * 4–6 heading: the Markdown reader keeps whatever `#` run a file uses, and
 * StarterKit's own input rule turns `####` into an H4. Two readers have to give the
 * same answer for such a heading — the toolbar's state hook, which names the block
 * at the caret, and the block menu, which marks the type of the block it acts on —
 * so the level-to-id mapping lives here, beside the rows it is about, rather than
 * in either reader. `null` is the answer "no row can name this block", and each
 * reader says what it does with that: the toolbar falls back to 正文 and the menu
 * marks none of its four rows.
 */
export function headingCommand(level: number): CommandId | null {
  return HEADING_COMMANDS[level] ?? null;
}

/**
 * The commands a query matches, in the table's order.
 *
 * A command matches when the query is a substring of its label or of any of its
 * keywords, case-insensitively and after trimming: `h1` reaches 标题 1, and `标题`
 * reaches all three headings in the order the table lists them. An empty query
 * is the whole table rather than nothing, because that is the state a slash menu
 * opens in.
 */
export function filterCommands(query: string): readonly CommandSpec[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return COMMANDS;

  return COMMANDS.filter((command) =>
    [command.label, ...command.keywords].some((word) => word.toLowerCase().includes(needle)),
  );
}

/**
 * The document constructs a slash command can produce.
 *
 * The slash menu inserts a block at the caret, so what it offers is exactly the
 * rows whose `block` names a node: a mark needs a selection the slash menu never
 * has, and 撤销 and 重做 act on the whole document rather than on a line.
 *
 * 链接 is a node-shaped row by name only: its behaviour is the field the toolbar
 * and the selection toolbar open, so it is not a slash command. 图片 and 表格 are
 * the two opposite kind of interface-shaped row — node-shaped, and behind an
 * interface too (#216, #217) — and both **are** offered here, for different
 * reasons. 图片 produces an image node, and the picker it opens belongs to the
 * surface that owns the file input: the row runs no chain, so `runCommand`
 * answers `false` and the menu hands the request to that surface. 表格 has no
 * second step, so applying it inserts the documented 3 × 3 directly
 * (`TABLE_DEFAULT_SIZE`); the command says a table arrives, and the surface
 * decides whether it arrives at a chosen size or the default one.
 *
 * `textBlock` is the one construct in the table that is deliberately absent:
 * alignment (#230) modifies a block instead of producing one, so neither the
 * slash menu nor the 块类型 popover may list it.
 */
const SLASH_BLOCKS: ReadonlySet<CommandBlock> = new Set<CommandBlock>([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "taskList",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "image",
  "table",
]);

/**
 * The commands the slash menu offers, filtered by what the visitor has typed.
 *
 * It is the same table under the same filter, narrowed by one predicate over the
 * row's own `block` field, so a block command added to the table appears in the
 * slash menu without a second edit and a mark can never leak into it.
 */
export function slashCommands(query: string): readonly CommandSpec[] {
  return filterCommands(query).filter((command) => SLASH_BLOCKS.has(command.block));
}
