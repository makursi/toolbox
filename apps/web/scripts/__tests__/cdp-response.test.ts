import { describe, expect, it } from "vitest";

import { classify } from "../cdp-response.mjs";

/**
 * These assertions exist because of one trap: a CDP response that carries an
 * error and no result used to be settled as a successful call whose value was
 * absent. Nothing threw, so one swallowed protocol error was read twice as a
 * page problem — the Instrument waited six seconds and reported "the page never
 * hydrated", and the fingerprint died inside a JSON parse with no mention of
 * the command that failed.
 */
describe("classify", () => {
  it("accepts an answer that carries a result", () => {
    expect(classify({ id: 1, result: { nodeId: 7 } })).toEqual({ ok: true });
  });

  it("accepts an empty result, which is what the enabling commands return", () => {
    expect(classify({ id: 2, result: {} })).toEqual({ ok: true });
  });

  it("rejects a protocol error, quoting its code and message", () => {
    const verdict = classify({ id: 3, error: { code: -32601, message: "Foo.bar wasn't found" } });

    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("-32601") });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("Foo.bar wasn't found") });
  });

  it("rejects a response that carries neither result nor error", () => {
    expect(classify({ id: 4 })).toEqual({
      ok: false,
      reason: "the response carried neither result nor error",
    });
  });

  it("rejects a response that is not an object at all", () => {
    expect(classify(null).ok).toBe(false);
    expect(classify(undefined).ok).toBe(false);
    expect(classify("nonsense").ok).toBe(false);
  });

  it("still says something usable when the error object is bare", () => {
    expect(classify({ id: 5, error: {} })).toEqual({
      ok: false,
      reason: "a protocol error with neither a code nor a message",
    });
  });
});
