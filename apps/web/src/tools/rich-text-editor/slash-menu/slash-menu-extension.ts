import { Extension, ReactRenderer } from "@tiptap/react";
import { Suggestion } from "@tiptap/suggestion";

import { slashCommands, type CommandSpec } from "../core/commands";
import { TABLE_DEFAULT_SIZE } from "../core/table";
import { insertTable, runCommand } from "../editor/execute";
import { SlashMenu, type SlashMenuHandle } from "./slash-menu";

/**
 * The slash menu's settings.
 *
 * 图片 is a command-table row with no chain behind it (#216): applying it must
 * insert an image, but the file input is the pinned toolbar's, not this menu's. So
 * the option is how the menu asks the surface that owns the input to open it — the
 * same seam the link's `Mod-K` uses, and the reason `runCommand` answers `false` for
 * an interface-shaped command rather than pretending it ran.
 */
export interface SlashMenuOptions {
  readonly onImageRequest?: () => void;
}

/**
 * The slash menu's wiring: `/` at the start of a paragraph opens the command table,
 * and what is typed after the slash filters it.
 *
 * The plugin is `@tiptap/suggestion`'s, configured rather than reimplemented: it
 * matches the `/` in the text before the caret, keeps the menu anchored to the caret
 * (`clientRect`, recomputed on scroll and resize), and forwards the keys. Escape is
 * the plugin's own — it closes the menu and consumes the key — so the menu component
 * only answers the arrow keys and Enter.
 *
 * The typing is not eaten: a space after the query ends the match, so `/标题 ` is a
 * slash, a word and a space rather than a command nobody can see. `startOfLine`
 * keeps a `/` inside a sentence as a slash: the trigger only counts at the start of
 * the paragraph's text, and only in a paragraph — a slash in the title heading is a
 * slash.
 */
export const SlashMenuExtension = Extension.create<SlashMenuOptions>({
  name: "slashMenu",

  addOptions() {
    return {};
  },

  addProseMirrorPlugins() {
    const requestImagePicker = this.options.onImageRequest;

    return [
      Suggestion<CommandSpec, CommandSpec>({
        editor: this.editor,
        char: "/",
        startOfLine: true,
        items: ({ query }) => [...slashCommands(query)],
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);

          // Depth 1 is a block directly in the document, and the type is the one
          // the placeholder sentence points at. The title heading and any nested
          // block keep their slashes as text.
          return $from.depth === 1 && $from.parent.type.name === "paragraph";
        },
        command: ({ editor, range, props }) => {
          // The typed `/query` is not document content: it is the filter, so it
          // goes before the command runs and the command acts on the empty block.
          editor.chain().focus().deleteRange(range).run();

          /*
           * 表格 is one of the commands whose behaviour is an interface rather than a
           * chain (#217), and this is where the two surfaces part company: the
           * toolbar opens the grid picker, while the slash menu is a keyboard gesture
           * that ends on Enter and has no second step. So it applies the documented
           * default (`TABLE_DEFAULT_SIZE`, 3 × 3) through the same insert the picker
           * commits. The command says a table arrives; the surface decides at what
           * size. 链接 has no such branch: it is not a slash command at all.
           */
          if (props.id === "table") {
            insertTable(editor, TABLE_DEFAULT_SIZE);
            return;
          }

          const ran = runCommand(editor, props.id);

          // 图片 is the other interface-shaped row that is a slash command, and it
          // runs no chain: the caller owns the interface and opens its picker. Every
          // other row left here is a real chain, which is why this is the only
          // `false` branch.
          if (!ran && props.id === "image") requestImagePicker?.();
        },
        render: () => {
          let component: ReactRenderer<SlashMenuHandle, SlashMenuPropsForRenderer> | null = null;
          let unmount: (() => void) | null = null;

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenu, {
                editor: props.editor,
                props: { command: props.command, items: props.items },
              });
              // `mount` is the plugin's own positioning: it appends the element to
              // the body, turns the caret's rectangle into coordinates and keeps them
              // right while the page scrolls or resizes.
              unmount = props.mount(component.element);
            },
            onUpdate: (props) => {
              component?.updateProps({ command: props.command, items: props.items });
            },
            onExit: () => {
              unmount?.();
              unmount = null;
              component?.destroy();
              component = null;
            },
            onKeyDown: (props) => {
              // Escape is the plugin's: it calls this handler and then closes the
              // menu itself, so answering it here would double-handle the key.
              if (props.event.key === "Escape") return false;

              return component?.ref?.onKeyDown(props) ?? false;
            },
          };
        },
      }),
    ];
  },
});

/** The subset of the plugin's props the menu is drawn from. */
type SlashMenuPropsForRenderer = {
  command: (item: CommandSpec) => void;
  items: readonly CommandSpec[];
};
