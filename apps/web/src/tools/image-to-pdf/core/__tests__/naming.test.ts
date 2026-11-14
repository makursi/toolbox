import { describe, expect, it } from "vitest";

import { pdfFileName } from "@/tools/image-to-pdf/core/naming";

/**
 * The file names itself. A visitor is never asked for a filename, so the only
 * decision here is the pattern, and the one thing worth holding in a test is
 * that local calendar days do not drift into UTC ones.
 */
describe("PDF file name", () => {
  it("derives the name from a date", () => {
    expect(pdfFileName(new Date(2026, 10, 14))).toBe("图片-2026-11-14.pdf");
  });

  it("pads a single-digit month and day", () => {
    expect(pdfFileName(new Date(2026, 0, 5))).toBe("图片-2026-01-05.pdf");
  });

  it("reads the visitor's local calendar day, not UTC", () => {
    // A date built from local parts at either end of a day must keep its own
    // day; reading the UTC fields would move one of them by one.
    expect(pdfFileName(new Date(2026, 11, 31, 23, 59))).toBe("图片-2026-12-31.pdf");
    expect(pdfFileName(new Date(2026, 0, 1, 0, 1))).toBe("图片-2026-01-01.pdf");
  });
});
