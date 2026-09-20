import { expect, test } from "@playwright/test";

import { convertInEveryFormat } from "./tool-page";

/**
 * The homepage promises "No accounts, no uploads", and ADR 0005 enforces it with
 * a CSP rather than with review discipline: `connect-src 'self'` makes a future
 * analytics script, telemetry beacon or third-party error reporter fail in the
 * browser instead of shipping quietly.
 *
 * This is the other half of that decision. The policy stops a request that is
 * *forbidden*; it says nothing about one that is merely unexpected — a font, an
 * icon set or a codec fetched from a CDN would be blocked by `img-src`/`font-src`
 * only if it is one of those, and a `.wasm` from a CDN would simply be allowed to
 * fail. Watching the requests themselves is what makes "nothing is loaded from a
 * third party" a fact about the page rather than a reading of the header.
 *
 * Every format is converted on purpose: each codec's WebAssembly module is a
 * separate file, and it is exactly the ones a single-target run would not touch
 * that could quietly come from somewhere else.
 */
test("a conversion reaches nothing off this origin, and prints nothing", async ({
  page,
  baseURL,
}) => {
  if (baseURL === undefined) throw new Error("the config sets no baseURL to compare against");
  const origin = new URL(baseURL).origin;

  const offSite: string[] = [];
  const noise: string[] = [];
  const crashes: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    // `blob:` is the Tool's own Worker and its own outputs, both minted in this
    // tab; `data:` is the icons, compiled in at build time.
    if (url.origin === origin || url.protocol === "blob:" || url.protocol === "data:") return;
    offSite.push(request.url());
  });

  page.on("console", (message) => {
    // Warnings too: the CSP reports a violation at that level, and a page that
    // logs one is a page where the policy did something nobody was watching.
    if (message.type() === "error" || message.type() === "warning") {
      noise.push(`${message.type()}: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => crashes.push(error.message));

  await convertInEveryFormat(page);

  // A run that converted nothing cannot say anything about what it requested, and
  // would pass every assertion below. That is the one way this check can lie.
  await expect(page.getByText("已生成 5 个文件", { exact: false })).toBeVisible();

  expect(offSite, "requests off this origin").toEqual([]);
  expect(noise, "console errors and warnings").toEqual([]);
  expect(crashes, "uncaught errors and unhandled rejections").toEqual([]);
});
