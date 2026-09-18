import type { ToolMeta } from "@/tools/types";

/**
 * The Tool Registry entry for this Tool — see `apps/web/src/tools/registry.ts`.
 *
 * The cover is one of the two assets in this repository that came from outside
 * it — the site mark is the other (`docs/adr/0011-the-mark-is-a-supplied-illustration.md`).
 * This one is a frame the owner supplied, captured with their own tooling.
 * Nothing is re-licensed by it being here, so it is not offered for reuse the way
 * the code is. The design deliberately keeps the frame's own colours rather than
 * a monochrome treatment — see the Assets section of `docs/design.md`.
 */
export const meta: ToolMeta = {
  slug: "image-converter",
  title: "图片格式转换",
  cover: "/tools/image-converter/cover.jpg",
  description: "在 PNG、JPEG、WebP、AVIF 与 BMP 之间批量互转。",
};
