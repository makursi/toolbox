import { describe, expect, it } from "vitest";

import {
  TEXT_ALIGNMENTS,
  TEXT_ALIGN_NODE_TYPES,
  canonicalTextAlign,
} from "@/tools/rich-text-editor/core/align";

/**
 * Alignment's shape (#230), the half both formats share.
 *
 * The value set, the two node types it is a property of, and the one canonical
 * form the HTML writer and the sanitiser must agree about: the document stores an
 * attribute, HTML stores a style, and the style a file carries has to come back as
 * the same tree it left as. Left is the absence of the attribute, so a `left` that
 * arrives in either form is the same document as no alignment at all.
 */
describe("the alignment attribute", () => {
  it("accepts the two values HTML writes, in any spelling, and treats left as absence", () => {
    expect(canonicalTextAlign("center")).toBe("center");
    expect(canonicalTextAlign("right")).toBe("right");
    expect(canonicalTextAlign(" right ")).toBe("right");
    expect(canonicalTextAlign("CENTER")).toBe("center");
    expect(canonicalTextAlign("left")).toBeNull();
    expect(canonicalTextAlign("justify")).toBeNull();
    expect(canonicalTextAlign("")).toBeNull();
    expect(canonicalTextAlign(undefined)).toBeNull();
    expect(canonicalTextAlign(2)).toBeNull();
  });

  it("names the node types it is a property of and the values the toolbar offers", () => {
    expect(TEXT_ALIGN_NODE_TYPES).toEqual(["paragraph", "heading"]);
    expect(TEXT_ALIGNMENTS).toEqual(["left", "center", "right"]);
  });
});
