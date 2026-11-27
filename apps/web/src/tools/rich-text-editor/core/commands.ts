/**
 * The one command table: every block, mark, list and insert this editor offers,
 * in the order the toolbar draws them.
 *
 * The table is pure data plus the filter the slash menu will use (#208). Nothing
 * here knows about TipTap: a command says what it applies to and what it is
 * called, and the toolbar's executor map turns its id into a TipTap chain. One
 * table is the point: a command added here is a command the toolbar and the
 * slash menu both render, so the two cannot disagree about what exists.
 *
 * The `block` field names the document construct a command applies: a node name
 * for a block, a mark name for an inline command, and `document` for the ones
 * that act on the whole document. It is the field the slash menu reads when it
 * has to say what a command will produce, not a description of the executor.
 */

export type CommandGroup = "history" | "block" | "mark" | "list" | "insert";

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
  | "bullet-list"
  | "ordered-list"
  | "task-list"
  | "blockquote"
  | "code-block"
  | "horizontal-rule"
  | "link"
  | "image";

export type CommandBlock =
  | "paragraph"
  | "heading"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "code"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "blockquote"
  | "codeBlock"
  | "horizontalRule"
  | "link"
  | "image"
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
 * right. The middle groups are the block menu, the inline marks and the lists.
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
  {
    block: "image",
    group: "insert",
    icon: "icon-[ph--image-bold]",
    id: "image",
    keywords: ["图片", "图像", "照片", "image", "photo", "picture"],
    label: "图片",
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
 * 链接 is a node-shaped row by name only: its behaviour is the field the toolbar
 * and the selection toolbar open, so it is not a slash command either. 图片 is the
 * other kind of interface-shaped row and **is** here: applying it produces an
 * image node, and the picker it opens is the caller's job (the row cannot run a
 * chain, so `runCommand` answers `false` and the slash menu hands the request to
 * the surface that owns the file input).
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
