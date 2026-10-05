/**
 * The Chrome DevTools Protocol connection the browser scripts share.
 *
 * Both `ui-fingerprint.mjs` and `touch-targets.mjs` talk to a Chrome that is
 * already running, over a debugging port: attaching to the first page target,
 * sending commands by id, and evaluating an expression in that page. That
 * connection is what this module holds. It also owns "is the browser still there": before
 * every navigation it probes the debugging port, and a browser that has gone
 * fails the run in a sentence naming the port and the command that starts it again,
 * instead of a connection error that reads like a page that never rendered that
 * control. And since #104 it owns "the navigation succeeded" as well: one call
 * navigates and resolves only once React has claimed the page, a navigation whose
 * result reports a failure throws rather than returning, and what one response means
 * is decided by a pure function instead of being read off the socket. Since #135 it
 * owns the third half of that as well — **the page has stopped changing** — because
 * the fingerprint grew the wait on its own when its first reading turned out to be
 * racing three things that arrive after hydration, and a second definition of "ready
 * to measure" in one of the two Instruments is exactly what ADR-0015 rejected.
 * The rest stays
 * in each script — which pages to visit, how to size the viewport and which media
 * features to emulate, how to report a result — because the two want different
 * versions of all three, and the one genuinely identical piece (a four-line console
 * wrapper) is not worth a module that would have to be named after nothing in
 * particular. That the list went from four to three is
 * `docs/adr/0015-the-shared-connection-layer-owns-the-navigation.md`.
 *
 * Deliberately no dependency: `WebSocket` and `fetch` are Node builtins from Node
 * 22 on, and a `node:`-only script is the point. This is an instrument — it
 * measures and prints, it does not assert — and the rule that an instrument
 * earns no dependency while plain CDP will do is `apps/web/docs/design/log.md`
 * item 3. The half that does assert runs on a test runner, in `apps/web/e2e/`
 * (`docs/adr/0012-playwright-for-the-browser-gate.md`).
 */
import { classify } from "./cdp-response.mjs";

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

/**
 * What "this page has stopped changing" means, in one expression: nothing is
 * animating, the document is loaded, and neither a resource nor a DOM mutation has
 * arrived since the last time this was asked.
 *
 * The four are not the same kind of thing on purpose (#135, measured 2026-10-05).
 * The animation is the `reveal` entrance — 12px over 600ms — and a reading taken
 * inside it lands on a fractional offset that `Math.round` flips between runs. The
 * resource count is how a lazily imported chunk is noticed: the cover generator's
 * icon library arrives after mount and its 50 rows are 236px of page. The mutation
 * count is how everything else is noticed, and it is the half with no cheaper
 * signal: Next appends its route announcer element on its own schedule, mounting
 * nothing and fetching nothing, and it was the difference between a cold browser
 * profile and a warm one on one unchanged build. And `readyState` is the cheap half
 * of all of them.
 *
 * Type is deliberately not part of it: a web font swapping in does not move the
 * boxes an Instrument reads, and waiting on `document.fonts` would make the shared
 * layer depend on a font loading policy it has no business in.
 *
 * The observer is installed on the first sample, so a mutation landing between the
 * navigation resolving and the first sample is in the past — the right place for it,
 * since it is not something a later reading can still see changing.
 */
const STILL = `(() => {
  if (window.__stillness === undefined) {
    window.__stillness = { mutations: 0 };
    new MutationObserver((records) => {
      window.__stillness.mutations += records.length;
    }).observe(document.body, { attributes: true, characterData: true, childList: true, subtree: true });
  }
  return JSON.stringify({
    animating: document.getAnimations().filter((a) => a.playState === 'running').length,
    mutations: window.__stillness.mutations,
    ready: document.readyState === 'complete',
    resources: performance.getEntriesByType('resource').length,
  });
})()`;

/**
 * How many samples of how many milliseconds a page is given to stop changing. Two
 * consecutive equal samples are what make this a wait rather than a snapshot: a
 * single reading of "nothing in flight" is satisfiable by the instant before a chunk
 * is requested. Four seconds of a page that never settles is a failure with a
 * sentence — a silent longer wait would turn a defect into a slow pass.
 */
const STILLNESS_ATTEMPTS = 40;
const STILLNESS_INTERVAL_MS = 100;

export async function connect(port) {
  if (typeof WebSocket === "undefined") {
    throw new Error("This check needs Node 22+ (global WebSocket). `node --version` first.");
  }

  // A browser that was never started is the commonest first mistake, and it is the
  // same event as one that went away mid-run: it gets the same sentence, rather than
  // the runtime's own "fetch failed" with nothing in it to act on.
  let targets;
  try {
    const listing = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
    });
    targets = await listing.json();
  } catch (cause) {
    throw new Error(
      gone(
        port,
        `nothing answered http://127.0.0.1:${port}/json/list (${
          cause instanceof Error ? cause.message : String(cause)
        })`,
      ),
      { cause: cause },
    );
  }
  if (!Array.isArray(targets)) {
    throw new Error(
      `http://127.0.0.1:${port}/json/list answered, but not with a list of targets — something else is on that port`,
    );
  }
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
    const response = JSON.parse(event.data);
    // No `id` is an event, not an answer to anything this module sent.
    if (response.id === undefined) return;
    settle(response.id, (entry) => {
      const verdict = classify(response);
      if (verdict.ok) entry.resolve(response);
      else entry.reject(new Error(`${entry.method}: ${verdict.reason}`));
    });
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
      pending.set(next, { method, reject, resolve, timer });
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
    const response = await command(method, params);
    // A navigation that failed is *answered*, not rejected: the failure travels in
    // the result. A caller that ignores it measures whatever the browser happens to
    // be showing, which is a page no server ever served.
    const failure = response.result?.errorText;
    if (method === "Page.navigate" && typeof failure === "string" && failure !== "") {
      throw new Error(`the page did not load: ${failure} (${params.url})`);
    }
    return response;
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

  /**
   * Wait for React to claim the page, rather than sleeping and hoping.
   *
   * The server sends prerendered HTML first, and a control in it looks exactly like
   * a hydrated one — but a click or a file dropped on the un-hydrated copy is
   * silently lost, which reads as "the page never rendered that control". The signal
   * is React's own bookkeeping on a host element (`__reactFiber…`, attached during
   * hydration, impossible in server HTML); the browser gate's page helper waits on
   * the same one. It is React's detail rather than this site's, which is what makes
   * it acceptable as a wait — and not as an assertion. The 1800 ms it replaced in the
   * fingerprint was wrong in both directions.
   *
   * It moved here from the hit-area Instrument (#104), so "ready to measure" has one
   * definition rather than two that drift.
   */
  const waitForHydration = async () => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const hydrated = await evaluate(
        `[...document.querySelectorAll('body *')].some((element) =>
          Object.keys(element).some((key) => key.startsWith('__reactFiber')),
        )`,
      );
      if (hydrated === true) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("the page never hydrated: React's bookkeeping never appeared");
  };

  /**
   * Wait for the page to stop changing, rather than sleeping and hoping.
   *
   * The third half of "the navigation succeeded", and it lives here rather than in
   * the Instrument that found it needing it, because "ready to measure" is one
   * property with one answer (ADR-0015, Decision 1 — and its rejected option names
   * this shape: fixing the fingerprint on its own is a second definition of it).
   * Both Instruments read geometry off the page they have just navigated to, so
   * both were exposed.
   */
  const waitForStillness = async () => {
    let previous = null;
    for (let attempt = 0; attempt < STILLNESS_ATTEMPTS; attempt++) {
      const sample = JSON.parse(await evaluate(STILL));
      if (
        sample.ready &&
        sample.animating === 0 &&
        previous !== null &&
        sample.mutations === previous.mutations &&
        sample.resources === previous.resources
      ) {
        return;
      }
      previous = sample;
      await new Promise((resolve) => setTimeout(resolve, STILLNESS_INTERVAL_MS));
    }
    throw new Error(
      `the page never stopped changing: ${STILLNESS_ATTEMPTS} samples of ${STILLNESS_INTERVAL_MS}ms without a still document — a reading taken while the page is still moving is not a reading`,
    );
  };

  /**
   * Go to a page and come back only once it can be measured: the navigation must
   * have arrived (see `send`), React must have claimed the document, and the page
   * must have stopped changing (see `waitForStillness`).
   */
  const navigate = async (url) => {
    await send("Page.navigate", { url });
    await waitForHydration();
    await waitForStillness();
  };

  await send("Page.enable");
  await send("Runtime.enable");
  return { close: () => socket.close(), evaluate, navigate, send };
}
