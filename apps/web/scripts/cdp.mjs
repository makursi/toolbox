/**
 * The Chrome DevTools Protocol connection the browser scripts share.
 *
 * Both `ui-fingerprint.mjs` and `touch-targets.mjs` talk to a Chrome that is
 * already running, over a debugging port: attaching to the first page target,
 * sending commands by id, and evaluating an expression in that page. That
 * connection is what this module holds. The rest stays in each script — which
 * pages to visit, how to size the viewport, how long to wait after a navigation,
 * how to report a result — because the two want different versions of all four,
 * and the one genuinely identical piece (a four-line console wrapper) is not
 * worth a module that would have to be named after nothing in particular.
 *
 * Deliberately no dependency: `WebSocket` and `fetch` are Node builtins from Node
 * 22 on, and a `node:`-only script is the point. This is an instrument — it
 * measures and prints, it does not assert — and the rule that an instrument
 * earns no dependency while plain CDP will do is `apps/web/docs/design/log.md`
 * item 3. The half that does assert runs on a test runner, in `apps/web/e2e/`
 * (`docs/adr/0012-playwright-for-the-browser-gate.md`).
 */
export async function connect(port) {
  if (typeof WebSocket === "undefined") {
    throw new Error("This check needs Node 22+ (global WebSocket). `node --version` first.");
  }

  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((target) => target.type === "page");
  if (!page)
    throw new Error(
      `No page target on port ${port}: start Chrome with --remote-debugging-port=${port}`,
    );

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const next = ++id;
      pending.set(next, resolve);
      socket.send(JSON.stringify({ id: next, method, params }));
    });

  const evaluate = async (expression) => {
    const response = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (response.result?.exceptionDetails) {
      throw new Error(response.result.exceptionDetails.exception?.description ?? "evaluate failed");
    }
    return response.result?.result?.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  return { send, evaluate, close: () => socket.close() };
}
