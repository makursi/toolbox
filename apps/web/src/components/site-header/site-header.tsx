import Image from "next/image";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";
import { siteName } from "@/lib/site";

/**
 * A slim header holding the logo and nothing else.
 *
 * There is no navigation to build yet (one Tool, two pages), so this is the way
 * home rather than a menu with one item in it. Height stays well under the 80px
 * ceiling, and it does not stick: with this little content a sticky bar would
 * cost attention it cannot pay back.
 *
 * Drawn by the incoming layer since #163. Every number here was read off the
 * outgoing layer on the built page before it was replaced, which is the method the
 * pilot used: the container is a 960px measure with 16px of padding either side and
 * 16px above and below, the wordmark is 16px on a 1.55 line at weight 600 beside a
 * 28px mark with 8px between them, and the hairline under the row is this site's
 * own token — the same value the outgoing layer's `--mantine-color-default-border`
 * resolved to, so it is a move and not a re-pick. `border-border` reads
 * `--site-hairline` through the stylesheet's `@theme inline` block, which is where
 * a value would otherwise be repeated.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-b-border" data-slot="site-header">
      <div className="mx-auto w-full max-w-[960px] px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/*
            The mark and the wordmark are one link home. The mark is the same
            character the tab shows — its crop and its sizes are in
            `apps/web/docs/design/assets.md` — and it is decorative: the name beside it
            already says what it is, so a screen reader reading both would hear
            the site name twice.
          */}
          <Link className="flex items-center gap-2 text-foreground no-underline" href="/">
            <Image alt="" height={28} src="/brand/makursi.png" width={28} />
            <span className="text-base leading-[1.55] font-semibold">{siteName}</span>
          </Link>
          {/* The scheme follows the operating system until this is used; ADR-0008
              records why a site that refused a toggle now has one. */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
