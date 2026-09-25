#!/usr/bin/env node
/**
 * The touch-target probe: the hit area of every `.touch-target` control, measured
 * in a real browser.
 *
 * `apps/web/docs/design/components.md` wants a 44px touch target, and the pre-flight
 * checklist claims no clickable control is under it at 360 / 390 / 768 / 1024.
 * That is a claim about the *rendered* page, so nothing short of a browser can
 * make it: `.touch-target` declares 44x44 on a pseudo-element, and a declaration
 * is not a hit area. On a Mantine `Button` the declaration was there and the hit
 * area was the button's own box, because the root clipped the overlay with
 * `overflow: hidden` — that is issue #29, and this script is what sees it.
 *
 * The method, so that the numbers mean something: walk out from the control's
 * centre one pixel at a time, asking `elementFromPoint` at each step, and stop
 * when either side stops answering. A 44px overlay reads 43, because 44 whole
 * pixels hold 43 interior sample points. Requiring *both* sides is deliberate: it
 * also catches a target that grew into a neighbour, which is the other way this
 * fails.
 *
 * What it deliberately does not cover: anything that is not hit-testing —
 * keyboard, focus order, the drawing. Those keep the one-off scripts and
 * `ui-fingerprint.mjs` (which answers "did anything move", not "is this big
 * enough"). The two controls the checklist needs a file for (清空 and a row's
 * remove cross) get one through CDP, the technique `apps/web/docs/design/log.md`
 * already records.
 *
 * Usage — Chrome has to be running already, because launching it is the part that
 * differs per machine:
 *
 *   pnpm build && pnpm --filter @toolbox/web start -p 3111
 *   chrome --headless=new --remote-debugging-port=9333 --user-data-dir=<tmp dir>
 *   pnpm --filter @toolbox/web touch-targets [baseUrl]
 *
 * `CDP_PORT` overrides the debugging port. Exit code is 1 when a control probes
 * under 43, when a control the page should carry is missing, or on horizontal
 * overflow, so it gates a shell chain.
 */
import { fileURLToPath } from "node:url";

import { connect } from "./cdp.mjs";

/** The four widths the pre-flight checklist names. */
const WIDTHS = [360, 390, 768, 1024];

/**
 * Both schemes: the toggle swaps a moon for a sun, and the two icons could differ
 * in size, which would move the control it sits in.
 */
const SCHEMES = ["light", "dark"];

/** Tall enough for the tool page to lay out; only the width is under test. */
const HEIGHT = 900;

/** The probe's resolution: a 44px span reads 43. */
const MIN = 43;

/**
 * The three pages, and the fewest controls each should carry (`minControls`) —
 * a probe that silently measured nothing would pass, which is the one way this
 * check can lie. The header's colour-scheme switch is on every page, because the
 * header is; the tool pages add 返回首页 (and the cover generator's counter of
 * controls grows with its slices: 2 in the spine slice, 3 once the download
 * button lands in #52). Fixed numbers rather than comfortable floors:
 * a regression that drops a control has to fail here rather than slip under the
 * bar.
 */
const PAGES = [
  { minControls: 1, name: "home", path: "/" },
  { minControls: 4, name: "tool", path: "/tools/image-converter" },
  { minControls: 3, name: "cover", path: "/tools/cover-generator" },
];

/**
 * A file for the list, because 清空 and the remove cross only exist once something
 * is in it. The Tool's own cover is a real JPEG the sniffer accepts, so no fixture
 * has to be committed and no encoder has to live in this script; the file is never
 * converted, only queued.
 */
const FIXTURE = fileURLToPath(
  new URL("../public/tools/image-converter/cover.jpg", import.meta.url),
);

const MEASURE = `(() => {
  const name = (el) => (el.getAttribute('aria-label') || el.innerText || '')
    .replace(/\\s+/g, ' ')
    .trim()
    .slice(0, 24);
  const hits = (el, x, y) => {
    const hit = document.elementFromPoint(x, y);
    return Boolean(hit) && (hit === el || el.contains(hit));
  };
  const span = (el, cx, cy, axis) => {
    let offset = 0;
    while (
      offset < 120 &&
      (axis === 'x'
        ? hits(el, cx - offset - 1, cy) && hits(el, cx + offset + 1, cy)
        : hits(el, cx, cy - offset - 1) && hits(el, cx, cy + offset + 1))
    ) {
      offset += 1;
    }
    return 2 * offset + 1;
  };
  const controls = [...document.querySelectorAll('.touch-target')].map((el) => {
    el.scrollIntoView({ block: 'center' });
    const rect = el.getBoundingClientRect();
    const cx = Math.round(rect.left + rect.width / 2);
    const cy = Math.round(rect.top + rect.height / 2);
    const after = getComputedStyle(el, '::after');
    return {
      control: el.tagName.toLowerCase() + (name(el) ? ' "' + name(el) + '"' : ''),
      drawn: Math.round(rect.width) + 'x' + Math.round(rect.height),
      declared: after.width + ' x ' + after.height,
      x: span(el, cx, cy, 'x'),
      y: span(el, cx, cy, 'y'),
    };
  });
  return JSON.stringify({
    controls,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  });
})()`;

/** A check's whole output is its result, which is the one place a console is right. */
function report(line) {
  // oxlint-disable-next-line no-console -- see above.
  console.log(line);
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url });
  // The page is prerendered, the hydrate has to finish before a click or a file
  // will be taken: the fingerprint waits the same 1800ms for the same reason.
  await new Promise((resolve) => setTimeout(resolve, 1800));
}

/**
 * Put a file into the page's file input. React does receive this: the input keeps
 * its own change event and CDP sets the files on it. See item 2 of `apps/web/docs/design/log.md` — headless Chrome can do this, and the claim that it could not was
 * a limitation of an older tool, not of the browser.
 */
async function addFile(client) {
  const document = await client.send("DOM.getDocument", { depth: 1 });
  const input = await client.send("DOM.querySelector", {
    nodeId: document.result.root.nodeId,
    selector: "input[type=file]",
  });
  if (!input.result?.nodeId) throw new Error("no file input on the tool page");
  await client.send("DOM.setFileInputFiles", {
    files: [FIXTURE],
    nodeId: input.result.nodeId,
  });
  // The row renders, then its thumbnail decodes into it; only the row's geometry
  // is measured, so this only has to outlast the render.
  await new Promise((resolve) => setTimeout(resolve, 1200));
}

async function probe(baseUrl) {
  const port = Number(process.env.CDP_PORT ?? 9333);
  const client = await connect(port);
  let failures = 0;

  try {
    for (const width of WIDTHS) {
      for (const scheme of SCHEMES) {
        await client.send("Emulation.setDeviceMetricsOverride", {
          width,
          height: HEIGHT,
          deviceScaleFactor: 1,
          mobile: width < 768,
        });
        await client.send("Emulation.setEmulatedMedia", {
          features: [{ name: "prefers-color-scheme", value: scheme }],
        });

        for (const page of PAGES) {
          await navigate(client, `${baseUrl}${page.path}`);
          if (page.name === "tool") {
            await addFile(client);
          }

          const measured = JSON.parse(await client.evaluate(MEASURE));
          report(`\n${width}px ${scheme} — ${page.path}`);

          if (measured.controls.length < page.minControls) {
            failures++;
            report(
              `  FAIL  expected at least ${page.minControls} touch-target control(s), found ${measured.controls.length} — the page did not render what this check measures`,
            );
          }

          if (measured.overflow > 0) {
            failures++;
            report(`  FAIL  horizontal overflow: ${measured.overflow}px`);
          }

          for (const control of measured.controls) {
            const ok = control.x >= MIN && control.y >= MIN;
            if (!ok) failures++;
            report(
              `  ${ok ? "PASS" : "FAIL"}  ${control.control} — drawn ${control.drawn}, declared ::after ${control.declared}, hit-testable ${control.x}x${control.y}`,
            );
          }
        }
      }
    }
  } finally {
    client.close();
  }

  report(
    failures === 0
      ? `\nALL PASS — every control answers at ${MIN}+ on both axes (44 within the probe's resolution)`
      : `\n${failures} FAILURE(S)`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

const [baseUrl = "http://127.0.0.1:3111"] = process.argv.slice(2);
await probe(baseUrl);
