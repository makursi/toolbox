/**
 * Site identity, shared by metadata, sitemap and robots.
 *
 * Server-only: SITE_URL is deliberately not a NEXT_PUBLIC_* variable, so it is
 * read at build time on the server rather than inlined into the client bundle.
 */
import type { Metadata } from "next";

const fallbackUrl = "http://localhost:3000";

export const siteName = "马库斯的大书箱";

export const siteDescription = "一批单一用途的浏览器小工具。不需要账号，文件不会离开你的设备。";

/**
 * Canonical origin, falling back to localhost so dev needs no configuration.
 *
 * An empty value is treated as unset: `??` would pass `SITE_URL=` straight
 * through, and `new URL("")` throws while the build collects page data.
 */
function resolveSiteUrl(): string {
  const configured = process.env.SITE_URL?.trim();
  return configured ? configured : fallbackUrl;
}

export const siteUrl = resolveSiteUrl();

/**
 * The metadata that makes a shared link a card rather than a bare line of text.
 *
 * A page that sets these fields *replaces* the ones it inherits whole, so the
 * site name and locale would silently disappear from every Tool page that only
 * wanted to change its own title. One helper is that rule in one place.
 *
 * No `images`: there is no share image, and no placeholder graphic is invented
 * to stand in for one (see section 9 of `apps/web/docs/design.md`), so the card is
 * meant to be text-only.
 */
export function shareMetadata(
  title: string,
  description: string,
): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: { type: "website", siteName, locale: "zh_CN", title, description },
    twitter: { card: "summary", title, description },
  };
}
