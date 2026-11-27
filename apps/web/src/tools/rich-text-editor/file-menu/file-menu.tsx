"use client";

import type { Editor } from "@tiptap/react";
import { useRef, useState, type ChangeEvent } from "react";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import type { ImageRefusal } from "../core/admission";
import {
  IMPORT_CANCEL_LABEL,
  IMPORT_CONFIRM_LABEL,
  IMPORT_DIALOG_DESCRIPTION,
  IMPORT_DIALOG_TITLE,
} from "../core/copy";
import { EMPTY_DOCUMENT, isEmptyDocument } from "../core/document";
import { htmlFromDocument } from "../core/html";
import { importHtml } from "../core/html-import";
import { IMPORT_ACCEPT, importFormatOf, type ImportFormat } from "../core/import";
import { markdownFromDocument } from "../core/markdown";
import { importMarkdown } from "../core/markdown-import";
import { exportFileName, type ExportFormat } from "../core/naming";

/**
 * The file menu at the toolbar's right end: 导入, the two exports and 清空.
 *
 * It is the one surface these four actions have, and it is deliberately not the
 * command table's. They are not editor commands: the exports derive a file from the
 * document instead of changing it, 导入 replaces the whole document through
 * TipTap's own `setContent`, and 清空 is the draft store's removal rather than a
 * `setContent` (the dead second definition that put an empty document through the
 * default update is gone). The command table is what the toolbar and the slash menu
 * render; this menu is file I/O around the document, so its rows are here.
 *
 * Each export asks the editor for its JSON, hands it to the pure writer in
 * `core/`, and downloads the bytes under the name `core/naming.ts` derives. 导入 is
 * one action for both accepted formats: a hidden file input takes the file, the
 * format rule in `core/import.ts` picks the parser, and the result goes back
 * through TipTap. When the draft says something, an alert dialog asks before it is
 * replaced; cancelling changes nothing. There is no filename field: the document
 * names itself, which is the rule #205 settled.
 */
interface PendingImport {
  readonly format: ImportFormat;
  readonly contents: string;
}

/** What each export is called in the menu, and the bytes it writes. */
const EXPORTS: readonly { format: ExportFormat; label: string; icon: string }[] = [
  { format: "markdown", icon: "icon-[ph--markdown-logo-bold]", label: "导出 Markdown" },
  { format: "html", icon: "icon-[ph--file-html-bold]", label: "导出 HTML" },
];

const MENU_ITEM_CLASS = "touch-target h-11 w-full justify-start gap-2 px-3 text-sm font-normal";

export interface FileMenuProps {
  readonly editor: Editor;
  /** 清空, which the writing surface routes through the draft store. */
  readonly onClear: () => void;
  /**
   * An imported file's refused images, or `null` when it kept everything (#220).
   *
   * The sentence belongs beside the canvas rather than in this menu: the popover is
   * closed by the time the import lands, and the line a refused insert paints is
   * already there. An import is a whole document, so this is the first rule its
   * images broke, and `core/copy.ts`'s sentence for that rule is the one a visitor
   * already knows.
   */
  readonly onImageRefusal: (refusal: ImageRefusal | null) => void;
}

export function FileMenu({ editor, onClear, onImageRefusal }: FileMenuProps) {
  const [fileOpen, setFileOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
   *
   * Each parser hands back the rules its images broke (#220), and the first one is
   * painted in the line a refused insert uses: an image over a limit is refused on
   * the way in with the sentence the visitor already knows, and its alt text is
   * what the document keeps in its place. A clean import clears that line.
   *
   * `setContent` emits an update (its default), so the import is written to the
   * local draft by the same path every other change takes (#209).
   */
  const applyImport = (format: ImportFormat, contents: string) => {
    if (format === "markdown") {
      const imported = importMarkdown(contents);

      editor.commands.setContent(imported.document);
      onImageRefusal(imported.refusals[0] ?? null);
    } else {
      const imported = importHtml(contents);

      editor.commands.setContent(imported.html === "" ? EMPTY_DOCUMENT : imported.html);
      onImageRefusal(imported.refusals[0] ?? null);
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

  return (
    <>
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
            className={MENU_ITEM_CLASS}
            onClick={() => fileInputRef.current?.click()}
            variant="ghost"
          >
            <span aria-hidden className="icon icon-[ph--upload-simple-bold]" />
            导入
          </Button>
          <span aria-hidden className="my-1 block h-px bg-border" />
          {EXPORTS.map((item) => (
            <Button
              className={MENU_ITEM_CLASS}
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
            className={MENU_ITEM_CLASS}
            onClick={() => {
              onClear();
              setFileOpen(false);
            }}
            variant="ghost"
          >
            <span aria-hidden className="icon icon-[ph--trash-bold]" />
            清空
          </Button>
        </PopoverContent>
      </Popover>

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
            <AlertDialogTitle>{IMPORT_DIALOG_TITLE}</AlertDialogTitle>
            <AlertDialogDescription>{IMPORT_DIALOG_DESCRIPTION}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="touch-target h-11">
              {IMPORT_CANCEL_LABEL}
            </AlertDialogCancel>
            <AlertDialogAction className="touch-target h-11" onClick={confirmImport}>
              {IMPORT_CONFIRM_LABEL}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
