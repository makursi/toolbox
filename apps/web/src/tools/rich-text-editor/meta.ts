import type { ToolMeta } from "@/tools/types";

/**
 * The Tool Registry entry for this Tool — see `apps/web/src/tools/registry.ts`.
 *
 * The description states the capability only. The cover is the owner's supplied
 * illustration, cropped to the card's 4:3 frame from a 1920×1080 frame on
 * 2026-11-27; its provenance and the exception it joins are recorded in
 * `apps/web/docs/design/assets.md`.
 */
export const meta: ToolMeta = {
  slug: "rich-text-editor",
  title: "富文本编辑器",
  description: "写一份带标题与段落的文档，排版后导出带走。",
  cover: "/tools/rich-text-editor/cover.jpg",
};
