/**
 * A CSS custom property set from a component's `style` — `--cover-preview-height`,
 * `--gap` — is an ordinary thing for this site to do: both are read by the rules in
 * `globals.css`, one as a sticky row's height and one as a spacing token.
 *
 * React's `CSSProperties` has no index signature for them, so the two call sites used
 * to satisfy the type with `as CSSProperties`. That assertion is exactly the shape a
 * custom property should not need, and it hid a real one: `no-unsafe-type-assertion`
 * fires on every new one, which is how a lint warning that cannot fail turns into
 * noise a reviewer learns to skip.
 *
 * Declaring the index signature once, here, is the honest version: `style` accepts any
 * `--*` key with a string or a number, a misspelt ordinary property is still an error,
 * and no call site needs a cast. The constraint is React's, so the augmentation is
 * React's interface rather than a wrapper type.
 */
import "react";

declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
