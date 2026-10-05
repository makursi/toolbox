# The shared connection layer owns "the navigation succeeded"

The two browser Instruments — the fingerprint and the hit-area Instrument — used to share only a socket: a connect, a command sent by id, an expression evaluated in the page, and the sentence a browser that disappeared gets. Everything about reaching a page stayed in each script, on purpose: which pages to visit, how to size the viewport, how long to wait after a navigation, and how to report a result.

That list was four items long and one of them was a mistake. "Did this navigation arrive, and is the page ready to be measured" is one property with one answer, and #104 found the three ways both scripts got it wrong on their own: a protocol-level error was settled as an answer whose value happened to be absent, so the Instrument blamed the page for six seconds and the fingerprint died inside a JSON parse; a navigation whose result reports a failure returned like any other; and the fingerprint never asked the question at all, sleeping 1800 ms instead — which is how two captures of a browser error page compared as "nothing moved", with a zero exit code.

## Decision

1. **The shared layer owns navigating.** One call navigates and resolves only once React has claimed the page: it checks that the browser is still there, checks the navigation result for a failure, and waits on the same hydration signal the browser gate waits on. Both Instruments call it.
2. **The shared layer owns what one CDP response means.** A response carrying an error rejects with the command's name; a response carrying neither a result nor an error rejects too. The classification is a pure function of the response, so the socket stops being the place where meaning is decided — and it is the one seam here a Node unit test can pin down with no browser, no socket and no dependency.
3. **What stays unshared is now three things**: which pages to visit, how to size the viewport and which media features to emulate, and how to report a result — because the two genuinely want different versions of each.
4. **The failure sentences do not change who starts the browser.** A browser that was never started and one that went away mid-run get the same actionable sentence, and neither is ever restarted: a silent relaunch would turn a crashed browser into a passed measurement.

## Consequences

- `apps/web/scripts/cdp.mjs` lists three unshared things instead of four, and both scripts reach a page through it.
- The hydration wait left the hit-area Instrument; "ready to measure" is now defined once, beside the connection it belongs to.
- The unit-test include reaches `apps/web/scripts/` for this one seam (#104). ADR-0003 is unchanged: it is a Vitest unit test in a `__tests__` directory beside the code it covers, in a Node environment.
- A protocol error names the method that was sent, so the two readings it used to produce — "the page never hydrated" and a parse error that named nothing — are gone.

## Considered Options

- **Leave navigation to each script, and fix the fingerprint on its own.** Rejected: the same three failures were found in both consumers, and the fingerprint's copy would have been written from scratch — a second definition of "ready to measure" rather than the first.
- **Share the whole navigation policy, viewport and waits included.** Rejected: the two want different pages, different viewports and different media emulation, and forcing a common shape on those would cost more than the duplication it removes.
- **Hand-roll a fake CDP server and test the layer end to end.** Rejected: this repository's Instruments take no dependency and need no WebSocket server, and a hand-written one in a test would exercise the transport while the defect was in classification. The pure function is the higher seam.
- **Keep the 1800 ms sleep and check the page's content instead.** Rejected: a sleep is a guess in both directions, and the hydration signal is the one the gate already trusts.

## Update — 2026-10-05 (#135): "ready to measure" also means "has stopped changing"

Decision 1 was missing half of itself, and the missing half was found the way the first one was: by an Instrument trusting its own timing.

`apps/web/scripts/ui-fingerprint.mjs` takes its first reading of a page straight after `navigate` returns. On this site the page is still arriving at that moment, and **three** separate things moved the reading afterwards — the `.reveal` entrance animation (600 ms of `translateY(12px)`, which lands on a fractional offset that `round` flips between runs), the cover generator's lazily imported icon library (236px of page, its 50 rows), and Next's route announcer element, which mounts nothing and fetches nothing. Measured on one unchanged build in one unchanged browser: two `capture` runs differed in three places, and a browser with a cold profile differed from a warm one on the same build.

The fix went into this layer, not into the script that found it, and the rejected option above is the reason: fixing the fingerprint on its own is a second definition of "ready to measure". Decision 1 therefore reads **"resolves only once React has claimed the page and the page has stopped changing"**, and `navigate` gained a third half, `waitForStillness` — no running CSS animation, `readyState === "complete"`, and neither a resource nor a DOM mutation arriving across two consecutive samples. It is a wait on the page's own state rather than a longer budget, for the reason the hydration wait gives, and a page that never settles fails with a sentence.

Both Instruments are affected, and that is the point: the hit-area Instrument reads geometry off the page it has just navigated to as well, so it was exposed to the same three arrivals and had only its own per-claim waits in front of them.
