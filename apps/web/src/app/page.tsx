import { ToolCard } from "@/components/tool-card/tool-card";
import { siteDescription, siteName } from "@/lib/site";
import { tools } from "@/tools/registry";

/**
 * The homepage: what the site is, and the Tools it has.
 *
 * Drawn by the incoming layer since #167, with the outgoing layer's numbers read off
 * the built page first: the same 960px measure with 16px either side and 48px/96px
 * above and below, a 40px/56px gap between the two blocks, the heading at 34px on a
 * 1.3 line at weight 600, and the description at 18px on a 1.6 line, dimmed, 560px
 * wide and 12px under the heading.
 *
 * The grid's breakpoint is Tailwind's `sm` — 640px — and the class says so: the
 * layout rule used to call it "sm (768px)", which was the *site's* `sm` and not the
 * one this class means. The number is what matters and it is unchanged; the sentence
 * that described it was wrong (`apps/web/docs/design/layout.md`).
 */
export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-12 sm:py-24">
      <div className="flex flex-col gap-10 sm:gap-14">
        <header className="reveal">
          <h1 className="text-[34px] leading-[1.3] font-semibold">{siteName}</h1>
          <p className="mt-3 max-w-[560px] text-lg leading-[1.6] text-muted-foreground">
            {siteDescription}
          </p>
        </header>

        <section className="reveal reveal-second">
          {tools.length === 0 ? (
            <p className="text-sm leading-[1.45] text-muted-foreground">还没有工具。</p>
          ) : (
            /*
             * The homepage grows into a grid the day the second Tool lands
             * (`apps/web/docs/design/layout.md`): one Tool stays a full-width
             * row, two Tools become two columns from 640px up. The count of
             * cells is the count of Tools; never pad a row with an empty cell.
             */
            <div className="grid gap-4 sm:grid-cols-2">
              {tools.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
