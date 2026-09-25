import type { ToolMeta } from "@/tools/types";

/**
 * The Tool Registry entry for this Tool — see `apps/web/src/tools/registry.ts`.
 *
 * The cover is an owner-supplied frame (1920×1080, 16:9), like the Image
 * Converter's: it keeps its own colours, it is not re-licensed by being here,
 * and the 4:3 card frame crops it left and right through `object-fit: cover`.
 * A 4:3 1320×990 export — this Tool's own preset — would replace it without
 * cropping; see `apps/web/docs/design/assets.md`.
 */
export const meta: ToolMeta = {
  slug: "cover-generator",
  title: "封面生成器",
  cover: "/tools/cover-generator/cover.jpg",
  description: "自由组合文字、图标与背景，导出 1:1、4:3、16:9、21:9 封面。",
};
