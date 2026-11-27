"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";

import { commandById, commandsInGroup, type CommandId, type CommandSpec } from "../core/commands";
import { EMPTY_DOCUMENT, isEmptyDocument } from "../core/document";
import { htmlFromDocument } from "../core/html";
import { sanitizeHtml } from "../core/html-import";
import { IMPORT_ACCEPT, importFormatOf, type ImportFormat } from "../core/import";
import { markdownFromDocument } from "../core/markdown";
import { documentFromMarkdown } from "../core/markdown-import";
import { exportFileName, type ExportFormat } from "../core/naming";

/**
 * The toolbar above the canvas: every command the table names, grouped the way
 * the table groups them.
 *
 * It is the table's first renderer, not a second list. The middle groups come
 * from `commandsInGroup` in table order, so a command added to the core appears
 * here without an edit; the executor map below is the only place this component
 * has to know a command's id, and TypeScript's `Record<CommandId, ...>` makes a
 * command with no handler a compile error rather than a dead button.
 *
 * The execution is TipTap's. A handler is one chain, and the browser gate is
 * what proves the chain applied: a toolbar that renders and does nothing is a
 * shape this component cannot check by itself.
 *
 * The file menu holds 导入 (#211), the two export actions (#210) and 清空. Each
 * export asks the editor for its JSON, hands it to the pure writer in `core/`,
 * and downloads the bytes under the name `core/naming.ts` derives. 导入 is one
 * action for both accepted formats: a hidden file input takes the file, the
 * format rule in `core/import.ts` picks the parser, and the result goes back
 * through TipTap's own `setContent`. When the draft says something, an alert
 * dialog asks before it is replaced; cancelling changes nothing. There is no
 * filename field: the document names itself, which is the rule #205 settled. The
 * save status arrives in #209.
 */

/** An import that is waiting on the visitor's confirmation. */
interface PendingImport {
  readonly format: ImportFormat;
  readonly contents: string;
}

/** Commands that read as on/off at the cursor; the rest are one-shot actions. */
const TOGGLE_COMMANDS: ReadonlySet<CommandId> = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "bullet-list",
  "ordered-list",
  "task-list",
  "blockquote",
  "code-block",
]);

/**
 * A pressed toggle is ink, and stays ink under the pointer.
 *
 * The vendored toggle's own on-state is the hover surface, which is 1.1:1
 * against the canvas: a mark that is on would look like a mark that is merely
 * hovered. Ink on paper is the site's one filled control (`Button`'s default
 * variant), so the state reuses it rather than inventing a second one. The
 * hover rules are restated because the toggle's own hover would otherwise win
 * on the pressed control and turn the label grey on ink.
 */
const TOGGLE_CLASS =
  "touch-target size-11 shrink-0 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground";

const LINK_INPUT_ID = "rich-text-link-url";

/** What each export is called in the menu, and the bytes it writes. */
const EXPORTS: readonly { format: ExportFormat; label: string; icon: string }[] = [
  { format: "markdown", icon: "icon-[ph--markdown-logo-bold]", label: "导出 Markdown" },
  { format: "html", icon: "icon-[ph--file-html-bold]", label: "导出 HTML" },
];

/** A hairline between two groups of controls. */
function Separator() {
  return <span aria-hidden className="h-6 w-px shrink-0 bg-border" />;
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  const [blockOpen, setBlockOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  /*
   * The state at the cursor, read through TipTap's own selector rather than
   * through React state of our own: the document is the editor's, and a copy of
   * "is bold on" in this component would be a second answer that goes stale
   * between a keystroke and a render. `pressed` is exhaustive so a new command
   * cannot quietly arrive without an answer for "is it on".
   */
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const block: CommandId = current.isActive("heading", { level: 1 })
        ? "heading-1"
        : current.isActive("heading", { level: 2 })
          ? "heading-2"
          : current.isActive("heading", { level: 3 })
            ? "heading-3"
            : "paragraph";

      return {
        block,
        canRedo: current.can().redo(),
        canUndo: current.can().undo(),
        pressed: {
          undo: false,
          redo: false,
          paragraph: block === "paragraph",
          "heading-1": block === "heading-1",
          "heading-2": block === "heading-2",
          "heading-3": block === "heading-3",
          bold: current.isActive("bold"),
          italic: current.isActive("italic"),
          underline: current.isActive("underline"),
          strike: current.isActive("strike"),
          code: current.isActive("code"),
          "bullet-list": current.isActive("bulletList"),
          "ordered-list": current.isActive("orderedList"),
          "task-list": current.isActive("taskList"),
          blockquote: current.isActive("blockquote"),
          "code-block": current.isActive("codeBlock"),
          "horizontal-rule": false,
          link: current.isActive("link"),
          clear: false,
        } satisfies Record<CommandId, boolean>,
      };
    },
  });

  /**
   * Every command, one handler each.
   *
   * This is the seam the table cannot cross: the table says what exists, and
   * this map says what it does. `Record<CommandId, ...>` is the exhaustiveness
   * check: adding an id to the table without a line here is a type error.
   */
  const run: Record<CommandId, () => void> = {
    undo: () => {
      editor.chain().focus().undo().run();
    },
    redo: () => {
      editor.chain().focus().redo().run();
    },
    paragraph: () => {
      editor.chain().focus().setParagraph().run();
    },
    "heading-1": () => {
      editor.chain().focus().toggleHeading({ level: 1 }).run();
    },
    "heading-2": () => {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    },
    "heading-3": () => {
      editor.chain().focus().toggleHeading({ level: 3 }).run();
    },
    bold: () => {
      editor.chain().focus().toggleBold().run();
    },
    italic: () => {
      editor.chain().focus().toggleItalic().run();
    },
    underline: () => {
      editor.chain().focus().toggleUnderline().run();
    },
    strike: () => {
      editor.chain().focus().toggleStrike().run();
    },
    code: () => {
      editor.chain().focus().toggleCode().run();
    },
    "bullet-list": () => {
      editor.chain().focus().toggleBulletList().run();
    },
    "ordered-list": () => {
      editor.chain().focus().toggleOrderedList().run();
    },
    "task-list": () => {
      editor.chain().focus().toggleTaskList().run();
    },
    blockquote: () => {
      editor.chain().focus().toggleBlockquote().run();
    },
    "code-block": () => {
      editor.chain().focus().toggleCodeBlock().run();
    },
    "horizontal-rule": () => {
      editor.chain().focus().setHorizontalRule().run();
    },
    link: () => {
      setHref(editor.getAttributes("link").href ?? "");
    },
    clear: () => {
      editor.chain().focus().setContent(EMPTY_DOCUMENT).run();
    },
  };

  const blockLabel = commandById(state.block).label;

  /**
   * Apply an imported file to the document.
   *
   * A Markdown file becomes JSON in `core/markdown-import.ts` and goes straight
   * into `setContent`; an HTML file is sanitised in `core/html-import.ts` and
   * TipTap's own parser is what turns it into the document. The final JSON is
   * therefore TipTap's in both cases, which is the point: the editor's schema is
   * the one authority on what a document may hold. An import that sanitises to
   * nothing is the empty document, so a file of only a `<script>` leaves the
   * same two placeholders a fresh page shows.
   */
  const applyImport = (format: ImportFormat, contents: string) => {
    if (format === "markdown") {
      editor.commands.setContent(documentFromMarkdown(contents));
    } else {
      const sanitized = sanitizeHtml(contents);
      editor.commands.setContent(sanitized === "" ? EMPTY_DOCUMENT : sanitized);
    }

    editor.commands.focus("start");
  };

  /**
   * Read the chosen file, then either import it or ask.
   *
   * The question is whether the draft would lose something, which is what
   * `isEmptyDocument` answers about what the document says rather than about how
   * many empty blocks it starts with. The file is read before the dialog opens,
   * so the dialog's confirm is synchronous and the file cannot go stale.
   */
  const chooseImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (file === null) return;

    setFileOpen(false);
    void file
      .text()
      .then((contents) => {
        const format = importFormatOf(file.name, contents);

        if (isEmptyDocument(editor.getJSON())) {
          applyImport(format, contents);
          return;
        }

        setPendingImport({ contents, format });
        setConfirmOpen(true);
      })
      .catch(() => undefined);
  };

  const closeImportDialog = (open: boolean) => {
    setConfirmOpen(open);
    if (!open) setPendingImport(null);
  };

  const confirmImport = () => {
    if (pendingImport === null) return;

    applyImport(pendingImport.format, pendingImport.contents);
  };

  /**
   * Download the document in one format.
   *
   * The bytes are the pure writer's and the name is the naming rule's; this
   * function only turns them into a download. The blob URL is revoked on the
   * next task rather than immediately, because the browser has to have taken the
   * bytes before the URL goes away, and an empty file is the one failure a
   * download cannot retry.
   */
  const download = (format: ExportFormat) => {
    const json = editor.getJSON();
    const contents = format === "markdown" ? markdownFromDocument(json) : htmlFromDocument(json);
    const type = format === "markdown" ? "text/markdown;charset=utf-8" : "text/html;charset=utf-8";
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement("a");

    link.download = exportFileName(json, format, new Date());
    link.href = url;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  };

  const toggle = (command: CommandSpec) => (
    <Toggle
      aria-label={command.label}
      className={TOGGLE_CLASS}
      key={command.id}
      onPressedChange={() => run[command.id]()}
      pressed={state.pressed[command.id]}
    >
      <span aria-hidden className={`icon ${command.icon}`} />
    </Toggle>
  );

  const action = (command: CommandSpec) => (
    <Button
      aria-label={command.label}
      className="touch-target size-11"
      key={command.id}
      onClick={() => run[command.id]()}
      size="icon"
      variant="ghost"
    >
      <span aria-hidden className={`icon ${command.icon}`} />
    </Button>
  );

  const applyLink = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = href.trim();
    const chain = editor.chain().focus().extendMarkRange("link");

    if (url === "") chain.unsetLink().run();
    else chain.setLink({ href: url }).run();

    setLinkOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  };

  return (
    /*
     * The row is the content column's width, not the canvas's 720px: sixteen
     * controls at the 44px floor do not fit a reading measure, and the toolbar
     * is page chrome above the measure rather than part of it. The middle groups
     * scroll as one region and the file menu is a sibling outside that region,
     * which is what keeps the right end still at 390px.
     */
    <div
      aria-label="格式工具栏"
      className="flex items-center gap-2 rounded-lg border border-border bg-background p-1"
      data-slot="rich-text-toolbar"
      role="toolbar"
    >
      <div
        className="flex min-w-0 flex-1 [scrollbar-width:thin] items-center gap-2.5 overflow-x-auto px-1 py-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
        data-slot="rich-text-toolbar-scroll"
      >
        {commandsInGroup("history").map((command) => (
          <Button
            aria-label={command.label}
            className="touch-target size-11"
            disabled={command.id === "undo" ? !state.canUndo : !state.canRedo}
            key={command.id}
            onClick={() => run[command.id]()}
            size="icon"
            variant="ghost"
          >
            <span aria-hidden className={`icon ${command.icon}`} />
          </Button>
        ))}

        <Separator />

        <Popover onOpenChange={setBlockOpen} open={blockOpen}>
          <PopoverTrigger asChild>
            <Button
              aria-label={`块类型：${blockLabel}`}
              className="touch-target h-11 gap-1.5 px-3 text-sm font-normal"
              variant="ghost"
            >
              <span>{blockLabel}</span>
              <span aria-hidden className="icon icon-[ph--caret-down-bold] text-[12px]" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-44 p-1">
            <div className="flex flex-col">
              {commandsInGroup("block").map((command) => (
                <Button
                  aria-current={state.block === command.id ? "true" : undefined}
                  className="touch-target h-11 w-full justify-start gap-2 px-3 text-sm font-normal"
                  key={command.id}
                  onClick={() => {
                    run[command.id]();
                    setBlockOpen(false);
                  }}
                  variant="ghost"
                >
                  <span
                    aria-hidden
                    className={`icon ${command.icon} ${
                      state.block === command.id ? "" : "invisible"
                    }`}
                  />
                  {command.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Separator />

        {commandsInGroup("mark").map(toggle)}

        <Separator />

        {commandsInGroup("list").map(toggle)}

        <Separator />

        {commandsInGroup("insert").map((command) => {
          if (command.id === "link") {
            return (
              <Popover key={command.id} onOpenChange={setLinkOpen} open={linkOpen}>
                <PopoverTrigger asChild>
                  <Button
                    aria-label={command.label}
                    className="touch-target size-11"
                    onClick={() => run.link()}
                    size="icon"
                    variant="ghost"
                  >
                    <span aria-hidden className={`icon ${command.icon}`} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 p-3">
                  <form className="flex flex-col gap-3" onSubmit={applyLink}>
                    <Label htmlFor={LINK_INPUT_ID}>链接地址</Label>
                    <Input
                      id={LINK_INPUT_ID}
                      onChange={(event) => setHref(event.target.value)}
                      placeholder="https://example.com"
                      value={href}
                    />
                    <div className="flex items-center justify-end gap-2">
                      {state.pressed.link ? (
                        <Button
                          className="touch-target h-11"
                          onClick={removeLink}
                          type="button"
                          variant="ghost"
                        >
                          移除
                        </Button>
                      ) : null}
                      <Button className="touch-target h-11" type="submit">
                        应用
                      </Button>
                    </div>
                  </form>
                </PopoverContent>
              </Popover>
            );
          }

          return TOGGLE_COMMANDS.has(command.id) ? toggle(command) : action(command);
        })}
      </div>

      <div className="flex shrink-0 items-center border-l border-border pl-2.5">
        <Popover onOpenChange={setFileOpen} open={fileOpen}>
          <PopoverTrigger asChild>
            <Button aria-label="文件" className="touch-target size-11" size="icon" variant="ghost">
              <span aria-hidden className="icon icon-[ph--folder-simple-bold]" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-1">
            {/*
             * One 导入 action for both formats. The picker is the hidden input
             * below, because an `input[type=file]` is a replaced element that
             * cannot be drawn as the menu row; the button is the real control and
             * opens it, the input is what receives the file (the pattern the cover
             * generator recorded in `apps/web/docs/design/components.md`).
             */}
            <Button
              className="touch-target h-11 w-full justify-start gap-2 px-3 text-sm font-normal"
              onClick={() => fileInputRef.current?.click()}
              variant="ghost"
            >
              <span aria-hidden className="icon icon-[ph--upload-simple-bold]" />
              导入
            </Button>
            <span aria-hidden className="my-1 block h-px bg-border" />
            {EXPORTS.map((item) => (
              <Button
                className="touch-target h-11 w-full justify-start gap-2 px-3 text-sm font-normal"
                key={item.format}
                onClick={() => {
                  download(item.format);
                  setFileOpen(false);
                }}
                variant="ghost"
              >
                <span aria-hidden className={`icon ${item.icon}`} />
                {item.label}
              </Button>
            ))}
            <span aria-hidden className="my-1 block h-px bg-border" />
            <Button
              className="touch-target h-11 w-full justify-start gap-2 px-3 text-sm font-normal"
              onClick={() => {
                run.clear();
                setFileOpen(false);
              }}
              variant="ghost"
            >
              <span aria-hidden className="icon icon-[ph--trash-bold]" />
              清空
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/*
       * The picker itself. It is visually hidden but not `display: none`, so it
       * stays a real input the browser (and the gate) can find and set; it holds
       * no `.touch-target` because it is not the control a visitor presses, the
       * 导入 row is.
       */}
      <input
        accept={IMPORT_ACCEPT}
        aria-label="导入 Markdown 或 HTML 文件"
        className="sr-only"
        onChange={chooseImportFile}
        ref={fileInputRef}
        type="file"
      />

      {/*
       * The confirmation, and the one thing the file menu cannot do by itself:
       * replacing a draft is destructive, so it asks. Cancelling closes the dialog
       * without touching the document, and the pending bytes are dropped with it.
       */}
      <AlertDialog onOpenChange={closeImportDialog} open={confirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>替换当前文档？</AlertDialogTitle>
            <AlertDialogDescription>
              导入的文件会替换当前文档，取消则保持原样。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="touch-target h-11">取消</AlertDialogCancel>
            <AlertDialogAction className="touch-target h-11" onClick={confirmImport}>
              替换
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
