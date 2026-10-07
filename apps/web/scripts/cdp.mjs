// The rules this layer implements — what it owns, and what it deliberately leaves to its callers — are in apps/web/docs/design/instruments.md#cdp.
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

const startCommand = (port) =>
  `chrome --headless=new --remote-debugging-port=${port} --user-data-dir=<tmp dir>`;

const gone = (port, what) =>
  `the browser on port ${port} is gone: ${what}\nStart it again with:\n  ${startCommand(port)}\n(a browser that dies mid-run is a failure, never a restart)`;

/**
 * What "this page has stopped changing" means, in one expression: nothing is
 * animating, the document is loaded, and neither a resource nor a DOM mutation has
 * arrived since the last time this was asked.
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
   * Wait for React to claim the page, rather than sleeping and hoping. The signal is
   * React's own bookkeeping on a host element — its detail rather than this site's,
   * which is what makes it acceptable as a wait and not as an assertion.
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

  /** Wait for the page to stop changing, rather than sleeping and hoping. */
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

  /**
   * Put a file into a file input on the page, by selector. React does receive it:
   * the input keeps its own change event and CDP sets the files on it.
   */
  const setFile = async (selector, path) => {
    const document = await send("DOM.getDocument", { depth: 1 });
    const input = await send("DOM.querySelector", {
      nodeId: document.result.root.nodeId,
      selector,
    });
    if (!input.result?.nodeId) throw new Error(`no file input matching ${selector}`);
    await send("DOM.setFileInputFiles", { files: [path], nodeId: input.result.nodeId });
  };

  await send("Page.enable");
  await send("Runtime.enable");
  /*
   * `settle` is the stillness wait on its own, for a caller that changes the page
   * *after* the navigation and has to wait for it to stop again — which is what
   * dropping a file is.
   */
  return {
    close: () => socket.close(),
    evaluate,
    navigate,
    send,
    setFile,
    settle: waitForStillness,
  };
}
