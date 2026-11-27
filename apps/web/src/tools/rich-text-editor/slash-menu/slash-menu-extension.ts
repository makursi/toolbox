import { Extension, ReactRenderer } from "@tiptap/react";
import { Suggestion } from "@tiptap/suggestion";

import { slashCommands, type CommandSpec } from "../core/commands";
import { runCommand } from "../editor/execute";
import { SlashMenu, type SlashMenuHandle } from "./slash-menu";

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
export const SlashMenuExtension = Extension.create({
  name: "slashMenu",

  addProseMirrorPlugins() {
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
          runCommand(editor, props.id);
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
