import { describe, expect, it } from "vitest";

import { addedSummary } from "../counts";

/**
 * The line above the file list is the only thing that says the button beside it
 * will also empty the download list, so its four states are the product here
 * rather than a detail of counting.
 */
describe("addedSummary", () => {
  it("says nothing when both lists are empty", () => {
    expect(addedSummary(0, 0)).toBeNull();
  });

  it("counts the files while no Batch has run", () => {
    expect(addedSummary(3, 0)).toBe("已添加 3 张");
  });

  it("counts the outputs after every source has been removed", () => {
    // Reachable: convert three files, then remove each one with its own cross.
    // The downloads are still there, so the line has to keep naming them.
    expect(addedSummary(0, 9)).toBe("已生成 9 个文件");
  });

  it("counts both, files first", () => {
    expect(addedSummary(3, 9)).toBe("已添加 3 张，已生成 9 个文件");
  });
});
