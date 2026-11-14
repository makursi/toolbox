import type { ToolMeta } from "@/tools/types";

/**
 * The Tool Registry entry for this Tool — see `apps/web/src/tools/registry.ts`.
 *
 * The description states the capability only. The promise that files stay on the
 * device is the footer's and the input region's; repeating it here would put it
 * on the homepage card twice and say nothing about what the Tool does.
 *
 * The cover is the owner's own illustration of the site's mark character, handed
 * to the repository on 2026-11-14 and cropped to 4:3 here. It is the same class
 * of asset as the other Tools' covers, and the same recorded exception: it keeps
 * its own colour rather than the site's warm monochrome, because a card with a
 * real picture is worth one deliberate splash, and it is **not** covered by this
 * repository's licence (`apps/web/docs/design/assets.md`). Nothing is re-licensed
 * by it being here.
 */
export const meta: ToolMeta = {
  slug: "image-to-pdf",
  title: "图片转 PDF",
  cover: "/tools/image-to-pdf/cover.jpg",
  description: "把图片按顺序合成一个 PDF，每页一张。",
};
