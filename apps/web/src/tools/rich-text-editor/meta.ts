import type { ToolMeta } from "@/tools/types";

/**
 * The Tool Registry entry for this Tool — see `apps/web/src/tools/registry.ts`.
 *
 * The description states the capability only. A Tool with no cover is set in type,
 * and no placeholder graphic is invented for it (`apps/web/docs/design/assets.md`);
 * the cover this one will have is its own ticket (#205's slices).
 */
export const meta: ToolMeta = {
  slug: "rich-text-editor",
  title: "富文本编辑器",
  description: "写一份带标题与段落的文档，排版后导出带走。",
};
