/**
 * The last line of every page.
 *
 * One sentence, small and dimmed: what the site promises about the files is the
 * only thing worth repeating down here. A footer is also where a visitor looks
 * to see whether a page is finished, so it is a hairline and a line of text
 * rather than nothing at all.
 *
 * Drawn by the incoming layer since #163, with the outgoing layer's own numbers:
 * 20px of padding above and below the line inside the same 960px measure the header
 * uses, a 32px gap above the hairline, and 12px of dimmed text on a 1.4 line. The
 * hairline is `--site-hairline`, which is the value the outgoing layer's variable
 * already resolved to.
 */
export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-t-border" data-slot="site-footer">
      <div className="mx-auto w-full max-w-[960px] px-4 py-5">
        <p className="text-xs leading-[1.4] text-muted-foreground">
          文件只在这台设备上处理，不上传，也不需要账号。
        </p>
      </div>
    </footer>
  );
}
