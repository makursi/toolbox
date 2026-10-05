import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

/**
 * The scratch route #115 asks for: it proves the generator, the alias and the App
 * agree, by rendering a generated Primitive through them.
 *
 * It is not a page of the site. It is not in the sitemap (that reads the Tool
 * registry, and this is not a Tool), and it asks not to be indexed. It exists for
 * the length of the pilot — #126 checks both colour schemes here, and the route
 * goes when the pilot page itself carries the proof (#132).
 *
 * The whole ladder is drawn rather than one button, because the thing being
 * checked is that the generated component renders at all: every variant and every
 * size, each labelled with its own name, which is a name rather than invented
 * data. Every control carries `.touch-target` — the registry's size ladder is
 * 24/32/36/40px, all under this site's 44px floor, and the floor is one of the
 * invariants the migration carries over untouched (`apps/web/docs/design.md`).
 * The generated `Button` renders a real `<button>`, which is the element that
 * owns the click, so the class sits where the rule requires.
 *
 * `data-layer="primitive"` marks a region as drawn by the new layer. It is not an
 * anchor for the instrument and not a style of its own: the stylesheet uses it to
 * re-point Tailwind's `white` and `black` at this site's paper and ink, so the ban
 * on pure black and pure white survives components nobody here can edit
 * (`apps/web/src/app/globals.css`).
 *
 * The `destructive` variant is deliberately absent. It is the one variant whose
 * colour is semantic — an error — and this site has never had an error value of
 * its own to move: the interface borrows Mantine's red today. Drawing it here
 * would either invent a colour or show a transparent box, so the palette for it is
 * #116's to decide and measure, and the variant comes back with a value.
 */
export const metadata: Metadata = {
  title: "Primitive",
  robots: { follow: false, index: false },
};

const variants = ["default", "secondary", "outline", "ghost", "link"] as const;
const sizes = ["sm", "default", "lg"] as const;

export default function ScratchPrimitivePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10" data-layer="primitive">
      <div className="flex flex-col gap-3">
        <p className="text-sm">variant</p>
        <div className="flex flex-wrap items-center gap-3">
          {variants.map((variant) => (
            <Button className="touch-target" key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm">size</p>
        <div className="flex flex-wrap items-center gap-3">
          {sizes.map((size) => (
            <Button className="touch-target" key={size} size={size}>
              {size}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
