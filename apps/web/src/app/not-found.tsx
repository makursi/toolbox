import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * The page for a URL this site does not serve.
 *
 * Next renders this inside the root layout, so the header, the theme and both
 * colour schemes come along for free — the built-in 404 is English, unstyled and
 * has no way back, which is a finished-looking site's most visible loose end.
 *
 * Three things and no more: what happened, why it probably happened, and one way
 * out. No oversized numeral and no illustration: the design forbids inventing
 * graphics, and a site with one Tool has no second destination worth suggesting.
 *
 * Drawn by the incoming layer since #163, with the outgoing layer's numbers read off
 * the built page: the same 960px measure with 16px either side and 40px/64px above
 * and below, a 10px stack gap, a 34px heading on a 1.3 line, a 560px measure of
 * dimmed 16px copy on 1.55, and the way home at 42px tall with 22px of inline
 * padding, 16px above it and 16px text.
 *
 * The way home is still a **real anchor** and still a Server Component: `asChild`
 * hands the Primitive's props to `next/link`, which renders an `<a href="/">` — so
 * the page keeps working with JavaScript off, and the linter's rule about an HTML
 * link to an internal page is satisfied rather than silenced. The label's colour is
 * one value that deliberately moved: the outgoing layer painted it pure white, and
 * this site's `text-primary-foreground` is its own paper, because pure white is
 * banned (`apps/web/docs/design/colour.md`) and the ban is not waived for a label.
 */
export const metadata: Metadata = { title: "没有这个页面" };

export default function NotFound() {
  return (
    /*
     * `data-slot` is an anchor, not a style and not behaviour (#114): this page is
     * part of the frame, it moves with the frame, and both Instruments have to be
     * able to address it before it moves (#161). The name is declared per page in
     * `apps/web/scripts/ui-fingerprint.mjs`.
     */
    <div className="mx-auto w-full max-w-[960px] px-4 py-10 sm:py-16" data-slot="not-found">
      <div className="reveal flex flex-col items-start gap-2.5">
        <h1 className="text-[34px] leading-[1.3] font-semibold">没有这个页面</h1>
        <p className="max-w-[560px] text-base leading-[1.55] text-muted-foreground">
          你打开的地址不在这里。可能是链接写错了，也可能是这个页面已经不存在了。
        </p>
        {/*
          `asChild` rather than a `<button>`: the exit has to be a link, and the
          Primitive's own element is a button. The anchor keeps `.touch-target`,
          which is the class that makes this control visible to
          `touch-targets.mjs` at all (#161).

          It is `next/link` and not a bare `<a>`: the outgoing layer used a string
          element (`component="a"`) because `component={Link}` would have handed a
          function to a Client Component, which the build rejects. `asChild` passes
          an *element*, so that reason is gone, the linter's `no-html-link-for-pages`
          is satisfied, and the rendered markup is still a real `<a href="/">` that
          works with JavaScript off.
        */}
        <Button
          asChild
          className="touch-target mt-4 h-[42px] border border-transparent px-[22px] text-base font-semibold"
        >
          <Link href="/">回到首页</Link>
        </Button>
      </div>
    </div>
  );
}
