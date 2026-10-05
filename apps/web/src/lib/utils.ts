/**
 * The class-merge helper, at the alias `components.json` gives the generator.
 *
 * A Primitive imports `cn` from the `cn` package directly — that is what the
 * registry writes, and this repository does not hand-edit a Primitive. This
 * module is the same function under the alias the App owns, so a component that
 * asks for `@/lib/utils` resolves to one implementation rather than to a second
 * one written here. `cn` is a compiled drop-in for `clsx` plus `tailwind-merge`;
 * nothing in this file re-implements it.
 */
export { cn } from "cn";
