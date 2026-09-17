import { describe, expect, it } from "vitest";

import { shareMetadata, siteDescription, siteName } from "@/lib/site";

/**
 * These assertions exist because of one specific trap: metadata fields are
 * replaced whole, not merged. A page that sets `openGraph.title` and stops there
 * loses `siteName`, `locale` and `type` from the card, and nothing in the build
 * complains — the tag is simply absent from the HTML.
 */
describe("shareMetadata", () => {
  it("keeps the site identity on every page that has its own title", () => {
    const { openGraph } = shareMetadata("图片格式转换", "在 PNG、JPEG 之间互转。");

    expect(openGraph).toMatchObject({
      type: "website",
      siteName,
      locale: "zh_CN",
      title: "图片格式转换",
      description: "在 PNG、JPEG 之间互转。",
    });
  });

  it("gives a text-only card, since there is no share image", () => {
    const { openGraph, twitter } = shareMetadata(siteName, siteDescription);

    expect(openGraph).not.toHaveProperty("images");
    expect(twitter).toEqual({
      card: "summary",
      title: siteName,
      description: siteDescription,
    });
  });
});
