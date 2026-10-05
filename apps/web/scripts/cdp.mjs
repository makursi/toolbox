/**
 * The Chrome DevTools Protocol connection the browser scripts share.
 *
 * Both `ui-fingerprint.mjs` and `touch-targets.mjs` talk to a Chrome that is
 * already running, over a debugging port: attaching to the first page target,
 * sending commands by id, and evaluating an expression in that page. That
 * connection is what this module holds. It also owns "is the browser still there":
 * before every navigation it probes the debugging port, and a browser that has gone
 * fails the run in a sentence naming the port and the command that starts it again,
 * instead of a connection error that reads like a page that never rendered that
 * control. The rest stays in each script — which pages to visit, how to size the
 * viewport, how long to wait after a navigation, how to report a result — because
 * the two want different versions of all four, and the one genuinely identical piece
 * (a four-line console wrapper) is not worth a module that would have to be named
 * after nothing in particular.
 *
 * Deliberately no dependency: `WebSocket` and `fetch` are Node builtins from Node
 * 22 on, and a `node:`-only script is the point. This is an instrument — it
 * measures and prints, it does not assert — and the rule that an instrument
 * earns no dependency while plain CDP will do is `apps/web/docs/design/log.md`
 * item 3. The half that does assert runs on a test runner, in `apps/web/e2e/`
 * (`docs/adr/0012-playwright-for-the-browser-gate.md`).
 */
/** How long the handshake — the target listing and the socket opening — may take. */
const CONNECT_TIMEOUT_MS = 10_000;

/**
 * How long one command may go unanswered. The number is generous on purpose: the
 * point is not to police a slow page, it is to stop a dead browser from hanging
 * the run until CI's own ceiling, which is hours.
 */
const COMMAND_TIMEOUT_MS = 30_000;

/**
 * How long the browser gets to answer "are you still there" before the run stops.
 * Two seconds: the probe runs before every navigation, so it is on the hot path of
 * a forty-second sweep, and a browser that is up answers this in single-digit
 * milliseconds.
 */
const PROBE_TIMEOUT_MS = 2_000;

/**
 * What a person types to get a browser back. Deliberately the same string the two
 * scripts' own headers show, port and all, so the failure below can be copied out
 * of the terminal and pasted into a shell — the one difference between machines is
 * the browser's path, and that is the caller's to know (the workflow's shell starts
 * the one `@playwright/test` pins; a person starts whatever Chrome is installed).
 */
const startCommand = (port) =>
  `chrome --headless=new --remote-debugging-port=${port} --user-data-dir=<tmp dir>`;

/**
 * The one sentence a run says when the browser it was driving is no longer there —
 * whichever of the two ways it found out: the debugging port stopped answering
 * before a navigation, or the socket to its page went down with a command in flight.
 * Both are the same event to whoever has to act on it, so both carry the same three
 * things: the port, the command that starts a browser again, and the rule that a
 * browser which dies mid-run is a failure rather than a silent restart.
 */
const gone = (port, what) =>
  `the browser on port ${port} is gone: ${what}\nStart it again with:\n  ${startCommand(port)}\n(a browser that dies mid-run is a failure, never a restart)`;

export async function connect(port) {
  if (typeof WebSocket === "undefined") {
    throw new Error("This check needs Node 22+ (global WebSocket). `node --version` first.");
  }

  const listing = await fetch(`http://127.0.0.1:${port}/json/list`, {
    signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
  });
  const targets = await listing.json();
  const page = targets.find((target) => target.type === "page");
  if (!page)
    throw new Error(
      `No page target on port ${port}: start Chrome with --remote-debugging-port=${port}`,
    );

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`the DevTools socket on port ${port} never opened`)),
      CONNECT_TIMEOUT_MS,
    );
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(new Error(`the DevTools socket on port ${port} failed to open`));
      },
      { once: true },
    );
  });

  let id = 0;
  const pending = new Map();

  /** Answer one command, or throw its error, and stop its clock. */
  const settle = (key, answer) => {
    const entry = pending.get(key);
    if (entry === undefined) return;
    clearTimeout(entry.timer);
    pending.delete(key);
    answer(entry);
  };

  /**
   * A browser that dies mid-run leaves every later command unanswered — and the
   * command it dies *during* is the common case, so this path says the same thing the
   * port probe says rather than a bare "socket closed" that names nothing to act on.
   */
  const abandon = (reason) => {
    // Deleting a key while walking a Map's keys is safe — the iterator steps over
    // what is gone (which is also why this needs no copy of the key list).
    for (const key of pending.keys()) {
      settle(key, (entry) => entry.reject(new Error(gone(port, `${reason} — command in flight`))));
    }
  };

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) settle(message.id, (entry) => entry.resolve(message));
  });
  socket.addEventListener("close", () => abandon("the DevTools socket closed"));
  socket.addEventListener("error", () => abandon("the DevTools socket errored"));

  const command = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const next = ++id;
      const timer = setTimeout(
        () =>
          settle(next, (entry) =>
            entry.reject(new Error(`${method} went unanswered for ${COMMAND_TIMEOUT_MS}ms`)),
          ),
        COMMAND_TIMEOUT_MS,
      );
      pending.set(next, { reject, resolve, timer });
      socket.send(JSON.stringify({ id: next, method, params }));
    });

  /**
   * Is the browser still there? Asked before every navigation, which is the one
   * moment the answer changes what the caller does — and the moment a browser that
   * died mid-run would otherwise be noticed thirty seconds later, by a command
   * timeout whose sentence reads like a page that never rendered that control. It
   * cost a whole round to misread it that way once.
   *
   * It probes the debugging port rather than the socket on purpose: the socket is
   * this page's, and the question is whether the browser is still behind it. There
   * is no restart, here or anywhere: a browser that disappears is a failure, and a
   * silent relaunch would turn a crashed run into a passed measurement.
   */
  const alive = async () => {
    try {
      await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
    } catch {
      throw new Error(
        gone(
          port,
          `nothing answered http://127.0.0.1:${port}/json/version in ${PROBE_TIMEOUT_MS}ms`,
        ),
      );
    }
  };

  /** Every command leaves through here, so the probe is one line and cannot be forgotten. */
  const send = async (method, params = {}) => {
    if (method === "Page.navigate") await alive();
    return command(method, params);
  };

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
