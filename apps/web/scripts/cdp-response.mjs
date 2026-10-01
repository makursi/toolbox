/**
 * What one CDP response means for the command that was sent.
 *
 * The shared connection layer hands every answered command to this function
 * before it settles it, so the socket is not the place where a message's
 * meaning is decided. It is kept pure — one response in, a verdict out —
 * because that is the only seam this layer has which a Node test can pin down
 * without a browser, a socket or a dependency (#104).
 *
 * The case it exists for: a protocol-level error arrives as a response carrying
 * an `error` and no `result`. Settling that as a success whose value is absent
 * is how one failed command was read twice as a page problem — "the page never
 * hydrated" after six seconds, and a JSON parse that named nothing at all.
 *
 * The `id` is the caller's business, not this function's: it is how the layer
 * finds the command waiting on the answer, and it is filtered before this runs
 * so that an event is never mistaken for one.
 */
/**
 * @param {unknown} response one message from the debugging socket, already known to
 * carry an `id`
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function classify(response) {
  if (response === null || typeof response !== "object") {
    return { ok: false, reason: `the response was not an object but ${typeof response}` };
  }

  if (response.error !== undefined && response.error !== null) {
    const { code, message } = response.error;
    const named = [
      code === undefined || code === null ? undefined : `code ${code}`,
      message === undefined || message === null || message === "" ? undefined : `"${message}"`,
    ]
      .filter((part) => part !== undefined)
      .join(": ");
    return {
      ok: false,
      reason:
        named === ""
          ? "a protocol error with neither a code nor a message"
          : `a protocol error — ${named}`,
    };
  }

  if (response.result === undefined) {
    return { ok: false, reason: "the response carried neither result nor error" };
  }

  return { ok: true };
}
