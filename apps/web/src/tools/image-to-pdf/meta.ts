import type { ToolMeta } from "@/tools/types";

/**
 * The Tool Registry entry for this Tool — see `apps/web/src/tools/registry.ts`.
 *
 * The description states the capability only. The promise that files stay on the
 * device is the footer's and the input region's; repeating it here would put it
 * on the homepage card twice and say nothing about what the Tool does.
 *
 * The Tool ships without a cover (`ToolMeta.cover` is optional), so its card is
 * set in type rather than padded with an invented placeholder.
 */
export const meta: ToolMeta = {
  slug: "image-to-pdf",
  title: "图片转 PDF",
  description: "把图片按顺序合成一个 PDF，每页一张。",
};
