import { describe, expect, it } from "vitest";

import { admitImages, type Candidate, type ListTotals } from "@/tools/image-to-pdf/core/admission";

/**
 * Who gets into the page list, in the order the visitor chose.
 *
 * One pure answer for a whole batch: what the bytes said each file is, how big
 * it is, what the list already holds. The hook reads the bytes and this decides,
 * so the rules can be tested without a browser or a File.
 */
const MB = 1024 * 1024;

function file(
  name: string,
  size: number,
  format: Candidate["format"],
  pixels: Candidate["pixels"] = { width: 1, height: 1 },
): Candidate {
  return { name, size, format, pixels };
}

function list(count = 0, bytes = 0): ListTotals {
  return { count, bytes };
}

const UNSUPPORTED = "这个格式的图片暂时不支持，请换成 JPEG、PNG 或 WebP 的图片。";
const NOT_IMAGE = "这个文件不是图片，换一个再试。";
const TOO_MANY = "一个列表最多 20 张图片，这张没有加入。";
const TOO_LARGE = "这张图片超过 20 MB 的单张上限，没有加入。";
const OVER_TOTAL = "所有图片合计不能超过 100 MB，这张没有加入。";
const DAMAGED = "这张图片已经损坏，读不出来，换一张再试。";

describe("admitImages", () => {
  it("takes JPEG, PNG and WebP, in input order, with the format the bytes named", () => {
    const decisions = admitImages(
      [file("a.jpg", 1000, "jpeg"), file("b.png", 2000, "png"), file("c.webp", 3000, "webp")],
      list(),
    );

    expect(
      decisions.map((decision) =>
        decision.ok ? { format: decision.format, name: decision.file.name } : decision,
      ),
    ).toEqual([
      { format: "jpeg", name: "a.jpg" },
      { format: "png", name: "b.png" },
      { format: "webp", name: "c.webp" },
    ]);
  });

  it("refuses every recognised format with the one unsupported sentence", () => {
    const decisions = admitImages(
      [
        file("photo.avif", 100, "avif"),
        file("scan.bmp", 100, "bmp"),
        file("phone.heic", 100, "heic"),
        file("loop.gif", 100, "gif"),
      ],
      list(),
    );

    expect(decisions).toHaveLength(4);
    for (const decision of decisions) {
      expect(decision.ok).toBe(false);
      if (!decision.ok) expect(decision.message).toBe(UNSUPPORTED);
    }
  });

  it("refuses a file whose bytes are not an image at all with its own sentence", () => {
    const [decision] = admitImages([file("notes.png", 100, null)], list());

    expect(decision?.ok).toBe(false);
    if (decision && !decision.ok) expect(decision.message).toBe(NOT_IMAGE);
  });

  it("refuses one image over 20 MB and takes one of exactly 20 MB", () => {
    const decisions = admitImages(
      [file("big.jpg", 20 * MB + 1, "jpeg"), file("edge.jpg", 20 * MB, "jpeg")],
      list(),
    );

    expect(decisions[0]?.ok).toBe(false);
    if (decisions[0] && !decisions[0].ok) expect(decisions[0].message).toBe(TOO_LARGE);
    expect(decisions[1]?.ok).toBe(true);
  });

  it("refuses a recognised image whose header cannot say how big it is", () => {
    const [decision] = admitImages([file("broken.png", 100, "png", null)], list());

    expect(decision?.ok).toBe(false);
    if (decision && !decision.ok) expect(decision.message).toBe(DAMAGED);
  });

  it("counts the existing list, so a second batch can hit the twenty-image limit", () => {
    const decisions = admitImages(
      [file("a.jpg", 100, "jpeg"), file("b.jpg", 100, "jpeg"), file("c.jpg", 100, "jpeg")],
      list(19),
    );

    expect(decisions[0]?.ok).toBe(true);
    expect(decisions[1]?.ok).toBe(false);
    expect(decisions[2]?.ok).toBe(false);
    if (decisions[1] && !decisions[1].ok) expect(decisions[1].message).toBe(TOO_MANY);
  });

  it("refuses a file that would push the list past 100 MB, then takes one that fits", () => {
    const decisions = admitImages(
      [file("a.jpg", 4 * MB, "jpeg"), file("b.jpg", 5 * MB, "jpeg")],
      list(1, 95 * MB),
    );

    expect(decisions[0]?.ok).toBe(true);
    expect(decisions[1]?.ok).toBe(false);
    if (decisions[1] && !decisions[1].ok) expect(decisions[1].message).toBe(OVER_TOTAL);

    const fits = admitImages(
      [file("c.jpg", 4 * MB, "jpeg"), file("d.jpg", 1 * MB, "jpeg")],
      list(1, 95 * MB),
    );
    expect(fits.map((decision) => decision.ok)).toEqual([true, true]);
  });

  it("does not spend the count or the total on a refused file", () => {
    const decisions = admitImages(
      [
        file("a.gif", 200 * MB, "gif"),
        file("b.jpg", 30 * MB, "jpeg"),
        file("c.jpg", 10 * MB, "jpeg"),
      ],
      list(19, 89 * MB),
    );

    expect(decisions.map((decision) => decision.ok)).toEqual([false, false, true]);
  });

  it("answers one decision per incoming file, in input order", () => {
    const incoming = [
      file("one.jpg", 10, "jpeg"),
      file("two.txt", 10, null),
      file("three.webp", 10, "webp"),
    ];

    const decisions = admitImages(incoming, list());

    expect(decisions).toHaveLength(incoming.length);
    expect(decisions.map((decision) => decision.file.name)).toEqual([
      "one.jpg",
      "two.txt",
      "three.webp",
    ]);
  });

  it("takes nothing from an empty batch", () => {
    expect(admitImages([], list())).toEqual([]);
  });
});
