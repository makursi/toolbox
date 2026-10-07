// The rules this module implements — what one CDP response means, and why deciding it is a pure function — are in apps/web/docs/design/instruments.md#cdp.
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
