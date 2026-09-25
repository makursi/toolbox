import type { ToolMeta } from "@/tools/types";

/**
 * The Tool Registry entry for this Tool — see `apps/web/src/tools/registry.ts`.
 *
 * No cover on purpose: the site loads only its own assets and never invents
 * artwork (see `apps/web/docs/design/assets.md`), so until the owner supplies a
 * 4:3 frame this Tool is listed in type alone.
 */
export const meta: ToolMeta = {
  slug: "cover-generator",
  title: "封面生成器",
  description: "自由组合文字、图标与背景，导出 1:1、4:3、16:9、21:9 封面。",
};
