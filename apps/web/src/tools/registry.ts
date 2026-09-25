import { meta as coverGenerator } from "./cover-generator/meta";
import { meta as imageConverter } from "./image-converter/meta";
import type { ToolMeta } from "./types";

/**
 * The single source of truth for which Tools exist — the Tool Registry.
 *
 * The homepage grid, navigation and sitemap all read this list, so adding a
 * Tool means adding one import here plus its implementation directory. Each
 * Tool keeps its own `meta.ts` so its metadata lives beside its implementation.
 */
export const tools: ToolMeta[] = [imageConverter, coverGenerator];

/** The route a Tool lives at, kept here so the template has one definition. */
export function toolPath(slug: string): string {
  return `/tools/${slug}`;
}
